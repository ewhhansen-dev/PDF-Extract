(function(global) {
  const TextExtractor = {
    /**
     * Extracts text from the document based on the scope.
     * @param {Document} doc - The document object.
     * @param {string} scope - 'page' or 'selection'.
     * @returns {string} - The extracted plain text.
     */
    extract: function(doc, scope) {
      if (scope === 'selection') {
        return this.extractSelection(doc);
      } else {
        return this.extractPage(doc);
      }
    },

    extractSelection: function(doc) {
      const selection = doc.defaultView.getSelection();
      if (!selection || selection.rangeCount === 0) return '';

      const container = doc.createElement('div');
      for (let i = 0; i < selection.rangeCount; i++) {
        container.appendChild(selection.getRangeAt(i).cloneContents());
      }

      return this.serialize(container);
    },

    extractPage: function(doc) {
      // 1. Identify main content
      let contentNode = this.findMainContent(doc);
      if (!contentNode) contentNode = doc.body;

      // 2. Clone to avoid modifying the page
      const clone = contentNode.cloneNode(true);

      // 3. Clean the clone
      this.cleanNode(clone);

      // 4. Serialize
      return this.serialize(clone);
    },

    findMainContent: function(doc) {
      // Priority 1: <article> tags
      const articles = Array.from(doc.getElementsByTagName('article'));
      if (articles.length > 0) {
        // Return the article with the most text
        return articles.reduce((prev, current) => {
          return (current.textContent.length > prev.textContent.length) ? current : prev;
        });
      }

      // Priority 2: <main> tag
      const main = doc.getElementsByTagName('main')[0];
      if (main) return main;

      // Priority 3: Density scoring
      // Iterate over potential containers (div, section)
      const candidates = [...doc.getElementsByTagName('div'), ...doc.getElementsByTagName('section')];
      let bestCandidate = null;
      let maxScore = 0;

      candidates.forEach(node => {
        // Skip hidden nodes (simple check)
        if (node.offsetParent === null) return;

        const score = this.scoreNode(node);
        if (score > maxScore) {
          maxScore = score;
          bestCandidate = node;
        }
      });

      return bestCandidate || doc.body;
    },

    scoreNode: function(node) {
      let score = 0;

      // Text length factor
      const text = node.textContent.trim();
      if (text.length < 50) return 0; // Too short

      score += text.length * 0.05;

      // Tag weight
      const tagName = node.tagName.toLowerCase();
      if (tagName === 'article') score += 50;
      if (tagName === 'section') score += 10;
      if (tagName === 'div') score += 5;

      // Class/ID weight (heuristics)
      const checkString = (node.className + ' ' + node.id).toLowerCase();

      if (checkString.includes('article') || checkString.includes('content') || checkString.includes('main') || checkString.includes('post') || checkString.includes('blog')) {
        score += 30;
      }
      if (checkString.includes('sidebar') || checkString.includes('menu') || checkString.includes('nav') || checkString.includes('footer') || checkString.includes('comment')) {
        score -= 50;
      }

      // Paragraph density
      const paragraphs = node.getElementsByTagName('p');
      score += paragraphs.length * 5;

      return score;
    },

    cleanNode: function(node) {
      const unwantedTags = ['script', 'style', 'noscript', 'nav', 'footer', 'aside', 'header', 'form', 'svg', 'iframe', 'button', 'input', 'textarea', 'select', 'option'];
      const unwantedSelectors = ['.ad', '.ads', '.advertisement', '.social-share', '.related-posts', '.comments', '#comments', '.sidebar', '#sidebar'];

      // Remove by tag
      unwantedTags.forEach(tag => {
        const elements = Array.from(node.getElementsByTagName(tag));
        elements.forEach(el => el.parentNode && el.parentNode.removeChild(el));
      });

      // Remove by selector (simplified, might miss some due to clone context if using querySelectorAll on node)
      // querySelectorAll works on elements too
      unwantedSelectors.forEach(selector => {
        const elements = Array.from(node.querySelectorAll(selector));
        elements.forEach(el => el.parentNode && el.parentNode.removeChild(el));
      });

      // Remove empty elements (optional, but good for cleanup)
      // Maybe later.
    },

    serialize: function(node) {
      let output = '';

      node.childNodes.forEach(child => {
        if (child.nodeType === 3) { // Text node
          const text = child.textContent.replace(/\s+/g, ' '); // Normalize spaces
          output += text;
        } else if (child.nodeType === 1) { // Element
          const tagName = child.tagName.toLowerCase();

          // Handling block elements
          const isBlock = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'article', 'section', 'main', 'header', 'footer', 'ul', 'ol', 'blockquote'].includes(tagName);
          const isListItem = tagName === 'li';
          const isHeading = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName);
          const isBr = tagName === 'br';
          const isImg = tagName === 'img';
          const isCanvas = tagName === 'canvas';

          if (isBlock) output += '\n';

          if (isListItem) output += '- ';
          if (isHeading) output += '\n'; // Extra space for heading

          if (isImg) {
            const alt = child.getAttribute('alt') || 'Image';
            output += ` [Image: ${alt}] `;
          } else if (isCanvas) {
             output += ` [Canvas] `;
          } else {
             output += this.serialize(child);
          }

          if (isBlock) output += '\n';
          if (isBr) output += '\n';
        }
      });

      // Post-processing cleanup: remove excessive newlines
      return output.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
    }
  };

  global.TextExtractor = TextExtractor;
})(window);
