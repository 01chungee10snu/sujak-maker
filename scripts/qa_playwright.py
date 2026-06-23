import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'qa-artifacts'
OUT.mkdir(parents=True, exist_ok=True)
URL = 'http://127.0.0.1:4173/'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

async def main():
    errors = []
    console_messages = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=CHROME, headless=True)
        page = await browser.new_page(viewport={'width': 1280, 'height': 900}, device_scale_factor=1)
        http_failures = []
        page.on('console', lambda msg: console_messages.append({'type': msg.type, 'text': msg.text}))
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        page.on('response', lambda response: http_failures.append({'status': response.status, 'url': response.url}) if response.status >= 400 else None)

        await page.goto(URL, wait_until='networkidle')
        await page.wait_for_selector('#game-canvas')
        await page.wait_for_function("() => window.YONGGANG_GAME_DATA && window.Matter")
        title = await page.locator('h1').inner_text()
        score = await page.locator('#score').inner_text()
        canvas_box = await page.locator('#game-canvas').bounding_box()
        version_status = await page.locator('#app-version-status').inner_text()
        app_version = await page.evaluate("() => window.YONGGANG_GAME_DATA.version")
        if app_version not in version_status:
            raise AssertionError(f'app version not shown: {app_version!r} not in {version_status!r}')
        await expect(page.locator('#app-version-status')).to_contain_text('최신 데이터 적용됨')
        await page.screenshot(path=str(OUT / '01-load.png'), full_page=True)

        image_status = await page.evaluate("""
        () => Array.from(document.images).map(img => ({
          src: img.getAttribute('src'), path: img.getAttribute('src')?.split('?')[0], complete: img.complete,
          naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight
        }))
        """)
        broken_images = [img for img in image_status if not img['complete'] or img['naturalWidth'] <= 0]
        loaded_sources = {img['path'] for img in image_status}
        expected_sources = {
            'assets/generated/yonggang-mascot.png',
            'assets/generated/value-chain-sprites.png',
            'assets/generated/factory-background.png',
        }
        missing_expected_images = sorted(expected_sources - loaded_sources)

        quiz_type = await page.evaluate("() => typeof startRecipeQuiz")
        if quiz_type != 'function':
            raise AssertionError(f'startRecipeQuiz unavailable: {quiz_type}')

        # Wrong answer path: must immediately GAME OVER DEAD.
        await page.evaluate("() => startRecipeQuiz()")
        await expect(page.locator('#recipe-quiz-overlay')).to_be_visible()
        wrong_help = await page.locator('#recipe-quiz-help').inner_text()
        await page.locator('#recipe-quiz-input').fill('틀림')
        await page.locator('#recipe-quiz-card button[type=submit]').click()
        await expect(page.locator('#game-over-overlay')).to_be_visible()
        wrong_title = await page.locator('#game-over-title').inner_text()
        wrong_message = await page.locator('#game-over-message').inner_text()
        await page.screenshot(path=str(OUT / '02-wrong-answer-game-over-dead.png'), full_page=True)
        if wrong_title != 'GAME OVER DEAD':
            raise AssertionError(f'wrong answer title expected GAME OVER DEAD, got {wrong_title!r}')

        # Correct answer path: overlay closes and score bonus is applied.
        await page.reload(wait_until='networkidle')
        await page.evaluate("() => startRecipeQuiz()")
        await expect(page.locator('#recipe-quiz-overlay')).to_be_visible()
        prompt = await page.locator('#recipe-quiz-prompt').inner_text()
        answer = await page.evaluate("""(prompt) => {
          const quiz = window.YONGGANG_GAME_DATA.recipeQuizzes.find(q => q.prompt === prompt);
          if (!quiz) throw new Error('quiz not found for prompt: ' + prompt);
          return quiz.answer;
        }""", prompt)
        before_score = await page.locator('#score').inner_text()
        await page.locator('#recipe-quiz-input').fill(answer)
        await page.locator('#recipe-quiz-card button[type=submit]').click()
        await expect(page.locator('#recipe-quiz-overlay')).to_be_hidden()
        after_score = await page.locator('#score').inner_text()
        await page.screenshot(path=str(OUT / '03-correct-answer-resume.png'), full_page=True)
        if int(after_score.replace(',', '')) <= int(before_score.replace(',', '')):
            raise AssertionError(f'correct answer did not increase score: {before_score} -> {after_score}')

        # Timeout path: force deadline elapsed, then timer update must end the game.
        await page.reload(wait_until='networkidle')
        await page.evaluate("() => startRecipeQuiz()")
        await expect(page.locator('#recipe-quiz-overlay')).to_be_visible()
        await page.evaluate("() => { quizDeadline = performance.now() - 1; updateRecipeTimer(); }")
        await expect(page.locator('#game-over-overlay')).to_be_visible()
        timeout_title = await page.locator('#game-over-title').inner_text()
        await page.screenshot(path=str(OUT / '04-timeout-game-over-dead.png'), full_page=True)
        if timeout_title != 'GAME OVER DEAD':
            raise AssertionError(f'timeout title expected GAME OVER DEAD, got {timeout_title!r}')

        bad_http = [r for r in http_failures if 'favicon' not in r['url'].lower()]
        bad_console = [m for m in console_messages if m['type'] in ('error', 'warning') and not any(word in m['text'].lower() for word in ['favicon'])]
        if not bad_http:
            bad_console = [m for m in bad_console if 'failed to load resource' not in m['text'].lower()]
        result = {
            'url': URL,
            'title': title,
            'initialScore': score,
            'canvasBox': canvas_box,
            'wrongHelp': wrong_help,
            'wrongTitle': wrong_title,
            'wrongMessage': wrong_message,
            'correctPrompt': prompt,
            'correctAnswer': answer,
            'scoreBeforeCorrect': before_score,
            'scoreAfterCorrect': after_score,
            'timeoutTitle': timeout_title,
            'imageStatus': image_status,
            'brokenImages': broken_images,
            'missingExpectedImages': missing_expected_images,
            'httpFailures': http_failures,
            'badHttpFailures': bad_http,
            'consoleErrorsOrWarnings': bad_console,
            'pageErrors': errors,
            'screenshots': [
                str(OUT / '01-load.png'),
                str(OUT / '02-wrong-answer-game-over-dead.png'),
                str(OUT / '03-correct-answer-resume.png'),
                str(OUT / '04-timeout-game-over-dead.png')
            ]
        }
        (OUT / 'playwright-qa-result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
        await browser.close()

        if broken_images:
            raise AssertionError('broken images: ' + json.dumps(broken_images, ensure_ascii=False))
        if missing_expected_images:
            raise AssertionError('missing expected images: ' + json.dumps(missing_expected_images, ensure_ascii=False))
        if errors:
            raise AssertionError('page errors: ' + json.dumps(errors, ensure_ascii=False))
        if bad_http:
            raise AssertionError('http failures: ' + json.dumps(bad_http, ensure_ascii=False))
        if bad_console:
            raise AssertionError('console errors/warnings: ' + json.dumps(bad_console, ensure_ascii=False))
        print(json.dumps(result, ensure_ascii=False, indent=2))

asyncio.run(main())
