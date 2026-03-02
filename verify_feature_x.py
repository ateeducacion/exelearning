import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Using a taller viewport to test sticky behavior specifically
        page = await browser.new_page(viewport={"width": 1280, "height": 800})

        await page.goto("http://localhost:8080")
        await page.wait_for_selector("text=Guest", timeout=10000)
        await page.click("text=Guest")
        await page.wait_for_timeout(3000)

        await page.click("text=New page")
        await page.wait_for_timeout(1000)

        await page.click("text=Information and presentation")
        await page.wait_for_timeout(1000)
        await page.click("text=Text")
        await page.wait_for_timeout(3000)

        # We need to make sure we scroll the correct element that has 'overflow: auto'.
        # Often it's an interior container like .exe-app-content or .exe-layout-main
        print("Finding scrollable container...")
        await page.evaluate("""
            const spacer = document.createElement('div');
            spacer.style.height = '1500px';
            spacer.style.backgroundColor = '#f0f0f0';
            spacer.innerText = 'TALL CONTENT';

            // Add it inside the iDevice
            const editor = document.querySelector('.exe-idevice-editor');
            if(editor) {
                editor.appendChild(spacer);
            }

            // Try to find the scrollable ancestor of the idevice
            let el = document.querySelector('.exe-idevice-editor');
            while (el && el !== document.body) {
                const style = window.getComputedStyle(el);
                if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                    console.log('Found scrollable element: ', el.className);
                    el.scrollBy(0, 500);
                    break;
                }
                el = el.parentElement;
            }
        """)

        await page.wait_for_timeout(1000)
        await page.screenshot(path="/home/jules/verification/idevice_edit_scrolled_real.png")
        print("Saved /home/jules/verification/idevice_edit_scrolled_real.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
