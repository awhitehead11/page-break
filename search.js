(function () {
  var form = document.querySelector(".search-form");
  var input = document.getElementById("book-search");
  var resultsRoot = document.getElementById("search-results");

  if (!form || !input || !resultsRoot) return;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getAuthors(book) {
    if (!book || !Array.isArray(book.authors) || book.authors.length === 0) {
      return "Unknown author";
    }

    return book.authors
      .map(function (author) {
        return author && author.name ? author.name : null;
      })
      .filter(Boolean)
      .join(", ");
  }

  function getBookLink(book) {
    if (!book || !book.formats) return null;

    return book.formats["text/html"] || book.formats["text/plain; charset=utf-8"] || book.formats["application/epub+zip"] || null;
  }

  function renderMessage(message) {
    resultsRoot.innerHTML = "<p>" + escapeHtml(message) + "</p>";
  }

  function renderResults(books) {
    if (!Array.isArray(books) || books.length === 0) {
      renderMessage("No results found.");
      return;
    }

    var html = "<ul>";

    books.forEach(function (book) {
      var title = escapeHtml(book && book.title ? book.title : "Untitled");
      var authors = escapeHtml(getAuthors(book));
      var link = getBookLink(book);
      var linkHtml = link
        ? '<a href="' + escapeHtml(link) + '" target="_blank" rel="noopener noreferrer">Open book</a>'
        : "No link available";

      html += "<li><strong>" + title + "</strong><br />Author: " + authors + "<br />" + linkHtml + "</li>";
    });

    html += "</ul>";
    resultsRoot.innerHTML = html;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    var query = input.value.trim();
    if (!query) {
      renderMessage("Type a book title to search.");
      return;
    }

    renderMessage("Searching...");

    try {
      var response = await fetch("https://gutendex.com/books?search=" + encodeURIComponent(query));
      if (!response.ok) {
        throw new Error("Request failed");
      }

      var data = await response.json();
      renderResults(data.results);
    } catch (error) {
      renderMessage("Something went wrong while searching.");
    }
  });
})();
