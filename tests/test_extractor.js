const fs = require('fs');
const path = require('path');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const extractorCode = fs.readFileSync(path.join(__dirname, '../extension/lib/extractor.js'), 'utf8');

const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
    <style>.ad { color: red; }</style>
</head>
<body>
    <nav>
        <a href="#">Home</a>
        <a href="#">About</a>
    </nav>
    <div class="sidebar">
        <h3>Sidebar</h3>
        <p>This is sidebar content.</p>
    </div>
    <div class="main-content">
        <article>
            <h1>Main Article Title</h1>
            <p>This is the first paragraph of the main content.</p>
            <p>This is the second paragraph.</p>
            <ul>
                <li>List item 1</li>
                <li>List item 2</li>
            </ul>
            <div class="ad">Buy this stuff!</div>
            <img src="test.jpg" alt="A test image">
        </article>
    </div>
    <footer>
        <p>Copyright 2023</p>
    </footer>
    <script>console.log('Ignore me');</script>
</body>
</html>
`;

const dom = new JSDOM(html, {
    runScripts: "dangerously",
    resources: "usable"
});

const window = dom.window;
const document = window.document;

// Execute the extractor code in the JSDOM environment
// We can wrap it in a script tag or just eval it.
// Since extractor.js expects 'window' to be global or passed.
// It uses `(function(global) { ... })(window);`
// In JSDOM, we can just eval it with `window` as the context, or append a script tag.

const script = document.createElement("script");
script.textContent = extractorCode;
document.body.appendChild(script);

// Now TextExtractor should be available on window
if (!window.TextExtractor) {
    console.error("TextExtractor not found on window!");
    process.exit(1);
}

console.log("Running extraction...");
const text = window.TextExtractor.extract(document, 'page');

console.log("--- Extracted Text ---");
console.log(text);
console.log("----------------------");

// Verification checks
let passed = true;

if (!text.includes("Main Article Title")) {
    console.error("FAIL: Missing Title");
    passed = false;
}
if (!text.includes("first paragraph")) {
    console.error("FAIL: Missing first paragraph");
    passed = false;
}
if (!text.includes("- List item 1")) {
    console.error("FAIL: Missing list item");
    passed = false;
}
if (text.includes("Sidebar")) {
    console.error("FAIL: Sidebar content included");
    passed = false;
}
if (text.includes("Home")) {
    console.error("FAIL: Nav content included");
    passed = false;
}
if (text.includes("Buy this stuff")) {
    console.error("FAIL: Ad content included");
    passed = false;
}
if (!text.includes("[Image: A test image]")) {
    console.error("FAIL: Image placeholder missing");
    passed = false;
}

if (passed) {
    console.log("✅ Extraction Test Passed");
} else {
    console.error("❌ Extraction Test Failed");
    process.exit(1);
}
