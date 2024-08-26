class MarkdownConverter {
    constructor() {
      this.rules = [
        { pattern: /^(\s*)#{1,6}\s+(.+)$/gm, replacement: (match, spaces, content, level) => {
          const hLevel = match.trim().indexOf(' ');
          return `${spaces}<h${hLevel}>${content.trim()}</h${hLevel}>`;
        }},
        { pattern: /\*\*(.+?)\*\*/g, replacement: '<strong>$1</strong>' },
        { pattern: /\*(.+?)\*/g, replacement: '<em>$1</em>' },
        { pattern: /`([^`\n]+)`/g, replacement: '<code>$1</code>' },
        { pattern: /^\s*[-*+]\s+(.+)$/gm, replacement: '<li>$1</li>' },
        { pattern: /^(\d+)\.\s+(.+)$/gm, replacement: '<li>$2</li>' },
        { pattern: /\[(.+?)\]\((.+?)\)/g, replacement: '<a href="$2">$1</a>' },
        { pattern: /^(\s*[-_*]){3,}\s*$/gm, replacement: '<hr>' },
      ];
    }
  
    convert(text, format) {
      let html = this.escapeHtml(text);
  
      // Handle code blocks
      html = html.replace(/```(\w+)?:?(\S*)\n([\s\S]+?)```/g, (match, lang, filePath, code) => {
        const language = lang || 'plaintext';
        const filePathHtml = filePath ? `<div class="code-file-path">${filePath}</div>` : '';
        return `${filePathHtml}<pre><code class="language-${language}">${code.trim()}</code></pre>`;
      });
  
      // Handle inline code
      html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  
      // Handle tables
      html = this.convertTables(html);
  
      if (format === 'markdown') {
        this.rules.forEach(rule => {
          if (typeof rule.replacement === 'function') {
            html = html.replace(rule.pattern, rule.replacement);
          } else {
            html = html.replace(rule.pattern, rule.replacement);
          }
        });
        
        // Wrap lists
        html = html.replace(/<li>(.+?)<\/li>/g, '<ul>$&</ul>');
        html = html.replace(/<\/ul><ul>/g, '');
        
        // Wrap paragraphs
        html = html.replace(/^(?!<[houpcta]).+/gm, '<p>$&</p>');
      }
      
      // Unescape HTML tags for proper rendering
      html = this.unescapeHtml(html);
      
      return html;
    }
  
    convertTables(text) {
      const tableRegex = /\|(.+)\|[\r\n]+\|([-:\| ]+)\|[\r\n]+((?:\|.+\|[\r\n]+)+)/g;
      return text.replace(tableRegex, (match, header, alignment, rows) => {
        const headers = header.split('|').map(h => h.trim()).filter(h => h);
        const aligns = alignment.split('|').map(a => a.trim()).filter(a => a);
        const tableRows = rows.trim().split('\n').map(row => 
          row.split('|').map(cell => cell.trim()).filter(cell => cell)
        );
  
        let tableHtml = '<table><thead><tr>';
        headers.forEach((h, i) => {
          let align = 'left';
          if (aligns[i]) {
            if (aligns[i].startsWith(':') && aligns[i].endsWith(':')) align = 'center';
            else if (aligns[i].endsWith(':')) align = 'right';
          }
          tableHtml += `<th style="text-align:${align}">${h}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';
  
        tableRows.forEach(row => {
          tableHtml += '<tr>';
          row.forEach((cell, i) => {
            let align = 'left';
            if (aligns[i]) {
              if (aligns[i].startsWith(':') && aligns[i].endsWith(':')) align = 'center';
              else if (aligns[i].endsWith(':')) align = 'right';
            }
            tableHtml += `<td style="text-align:${align}">${cell}</td>`;
          });
          tableHtml += '</tr>';
        });
  
        tableHtml += '</tbody></table>';
        return tableHtml;
      });
    }
  
    escapeHtml(unsafe) {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  
    unescapeHtml(safe) {
      return safe
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
    }
  }
  
  class ChatMarkdownProcessor {
    constructor() {
      this.converter = new MarkdownConverter();
    }
  
    processInput(text, format) {
      return this.converter.convert(text, format);
    }
  }
  
  export { ChatMarkdownProcessor };