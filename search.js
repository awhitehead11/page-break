(function () {
  var form = document.querySelector(".search-form");
  var input = document.getElementById("book-search");
  var resultsRoot = document.getElementById("search-results");
  var SOURCE_NAME = "Gutenberg";
  var resultState = {
    books: [],
    initialView: "full",
  };

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

  function normalizeForMatch(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function normalizeSearchQuery(value) {
    return String(value || "")
      .trim()
      .replace(/&/g, " and ")
      .replace(/[.,:;!?'"`()[\]{}]/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function getSearchQueryVariations(value) {
    var normalizedQuery = normalizeSearchQuery(value);
    if (!normalizedQuery) return [];

    var parts = normalizedQuery.split(" ").filter(Boolean);
    var variations = [normalizedQuery];

    if (parts.length > 4) {
      variations.push(parts.slice(0, 4).join(" "));
    }

    if (parts.length > 3) {
      variations.push(parts.slice(0, 3).join(" "));
    }

    return Array.from(new Set(variations));
  }

  async function fetchBooksByQuery(query) {
    var response = await fetch("https://gutendex.com/books/?search=" + encodeURIComponent(query));
    if (!response.ok) {
      throw new Error("Request failed");
    }

    var data = await response.json();
    return Array.isArray(data && data.results) ? data.results : [];
  }

  function isHighConfidenceTopResult(book, query) {
    if (!book) return false;

    var normalizedQuery = normalizeForMatch(query);
    var normalizedTitle = normalizeForMatch(book.title);
    if (!normalizedQuery || !normalizedTitle) return false;

    if (normalizedTitle === normalizedQuery || normalizedQuery === normalizedTitle) {
      return true;
    }

    if (
      normalizedTitle.indexOf(normalizedQuery) === 0 &&
      normalizedQuery.length >= Math.max(4, Math.floor(normalizedTitle.length * 0.6))
    ) {
      return true;
    }

    var normalizedAuthors = normalizeForMatch(getAuthors(book));
    return normalizedAuthors === normalizedQuery;
  }

  function buildResultRow(book, otherResultsCell) {
    var title = escapeHtml(book && book.title ? book.title : "Untitled");
    var authors = escapeHtml(getAuthors(book));
    var link = getBookLink(book);
    var linkHtml = link
      ? '<a href="' + escapeHtml(link) + '" target="_blank" rel="noopener noreferrer">Open book</a>'
      : "No link available";
    var otherCellHtml = typeof otherResultsCell === "string" ? otherResultsCell : "—";

    return (
      "<tr>" +
      "<td>" +
      title +
      "</td>" +
      "<td>" +
      authors +
      "</td>" +
      "<td>" +
      escapeHtml(SOURCE_NAME) +
      "</td>" +
      "<td>" +
      linkHtml +
      "</td>" +
      "<td>" +
      otherCellHtml +
      "</td>" +
      "</tr>"
    );
  }

  function buildResultsTable(rows) {
    return (
      '<div class="results-table-wrap">' +
      '<table class="results-table">' +
      "<thead>" +
      "<tr>" +
      '<th scope="col">Book title</th>' +
      '<th scope="col">Author</th>' +
      '<th scope="col">Source</th>' +
      '<th scope="col">Link</th>' +
      '<th scope="col">Other results</th>' +
      "</tr>" +
      "</thead>" +
      "<tbody>" +
      rows +
      "</tbody>" +
      "</table>" +
      "</div>"
    );
  }

  function renderMessage(message) {
    resultsRoot.innerHTML = "<p>" + escapeHtml(message) + "</p>";
  }

  function renderSummaryResult(books) {
    var topResult = books[0];
    var otherResultsCount = Math.max(books.length - 1, 0);
    var otherResultsHtml =
      otherResultsCount > 0
        ? '<a href="#" data-action="show-all-results">' + otherResultsCount + "</a>"
        : "0";

    resultsRoot.innerHTML = buildResultsTable(buildResultRow(topResult, otherResultsHtml));
  }

  function renderFullResults(books, showBackButton) {
    var rows = books
      .map(function (book, index) {
        var otherResultsCount = Math.max(books.length - 1, 0);
        var otherResultsCell = index === 0 ? String(otherResultsCount) : "—";
        return buildResultRow(book, otherResultsCell);
      })
      .join("");

    var backButtonHtml = showBackButton
      ? '<button type="button" class="results-back-button" data-action="show-summary">Back</button>'
      : "";

    resultsRoot.innerHTML = backButtonHtml + buildResultsTable(rows);
  }

  function renderInitialResults() {
    if (!Array.isArray(resultState.books) || resultState.books.length === 0) {
      renderMessage("No results found.");
      return;
    }

    if (resultState.initialView === "summary") {
      renderSummaryResult(resultState.books);
      return;
    }

    renderFullResults(resultState.books, false);
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    var rawQuery = input.value;
    var queries = getSearchQueryVariations(rawQuery);
    if (queries.length === 0) {
      renderMessage("Type a book title to search.");
      return;
    }

    renderMessage("Searching...");

    try {
      var books = [];
      for (var i = 0; i < queries.length; i++) {
        books = await fetchBooksByQuery(queries[i]);
        if (books.length > 0) {
          break;
        }
      }
      if (books.length === 0) {
        renderMessage("No results found.");
        return;
      }

      resultState.books = books;
      resultState.initialView = isHighConfidenceTopResult(books[0], queries[0]) ? "summary" : "full";
      renderInitialResults();
    } catch (error) {
      renderMessage("Something went wrong while searching.");
    }
  });

  resultsRoot.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || typeof target.closest !== "function") return;

    var showAllLink = target.closest('[data-action="show-all-results"]');
    if (showAllLink) {
      event.preventDefault();
      renderFullResults(resultState.books, true);
      return;
    }

    var showSummaryButton = target.closest('[data-action="show-summary"]');
    if (showSummaryButton) {
      event.preventDefault();
      renderInitialResults();
    }
  });
})();
