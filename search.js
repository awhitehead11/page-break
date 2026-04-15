(function () {
  var form = document.querySelector(".search-form");
  var input = document.getElementById("book-search");
  var resultsRoot = document.getElementById("search-results");
  var SOURCES = [
    { id: "gutenberg", name: "Gutenberg" },
    { id: "open-library", name: "Open Library" },
  ];
  var resultState = {
    sourceResults: {},
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

  function parseTitleAuthorQuery(value) {
    var normalizedQuery = normalizeSearchQuery(value);
    if (!normalizedQuery) {
      return {
        normalizedQuery: "",
        title: "",
        author: "",
        hasTitleAndAuthor: false,
      };
    }

    var byParts = normalizedQuery.split(/\s+by\s+/).map(function (part) {
      return part.trim();
    });

    if (byParts.length >= 2 && byParts[0] && byParts[1]) {
      return {
        normalizedQuery: normalizedQuery,
        title: byParts[0],
        author: byParts.slice(1).join(" by ").trim(),
        hasTitleAndAuthor: true,
      };
    }

    return {
      normalizedQuery: normalizedQuery,
      title: "",
      author: "",
      hasTitleAndAuthor: false,
    };
  }

  function isEnglishLanguageCode(languageCode) {
    var normalizedCode = String(languageCode || "").trim().toLowerCase();
    if (!normalizedCode) return false;
    var canonicalCode = normalizedCode.split("/").filter(Boolean).pop() || normalizedCode;
    return (
      canonicalCode === "en" ||
      canonicalCode === "eng" ||
      canonicalCode === "en-us" ||
      canonicalCode === "en-gb" ||
      canonicalCode === "english"
    );
  }

  function hasEnglishLanguage(languages) {
    if (!Array.isArray(languages) || languages.length === 0) return false;
    return languages.some(isEnglishLanguageCode);
  }

  function getSearchQueryVariations(value) {
    var parsedQuery = parseTitleAuthorQuery(value);
    if (!parsedQuery.normalizedQuery) return [];

    var parts = parsedQuery.normalizedQuery.split(" ").filter(Boolean);
    var variations = [parsedQuery.normalizedQuery];

    if (parsedQuery.hasTitleAndAuthor) {
      variations.push(parsedQuery.title + " " + parsedQuery.author);
      variations.push(parsedQuery.title);
      variations.push(parsedQuery.author);
    }

    if (parts.length > 4) {
      variations.push(parts.slice(0, 4).join(" "));
    }

    if (parts.length > 3) {
      variations.push(parts.slice(0, 3).join(" "));
    }

    return Array.from(new Set(variations));
  }

  function getBookAuthors(book) {
    return book && book.authors ? book.authors : "Unknown author";
  }

  function isStrongNormalizedMatch(targetValue, queryValue) {
    if (!targetValue || !queryValue) return false;

    if (targetValue === queryValue) {
      return true;
    }

    if (
      targetValue.indexOf(queryValue) === 0 &&
      queryValue.length >= Math.max(3, Math.floor(targetValue.length * 0.45))
    ) {
      return true;
    }

    return targetValue.indexOf(queryValue) !== -1 && queryValue.length >= 4;
  }

  function isHighConfidenceTopResult(book, query) {
    if (!book) return false;

    var parsedQuery = parseTitleAuthorQuery(query);
    var normalizedQuery = normalizeForMatch(parsedQuery.normalizedQuery);
    var normalizedTitle = normalizeForMatch(book.title);
    if (!normalizedQuery || !normalizedTitle) return false;

    var normalizedAuthors = normalizeForMatch(getBookAuthors(book));

    if (parsedQuery.hasTitleAndAuthor) {
      var titleMatches = isStrongNormalizedMatch(normalizedTitle, normalizeForMatch(parsedQuery.title));
      var authorMatches = isStrongNormalizedMatch(normalizedAuthors, normalizeForMatch(parsedQuery.author));
      if (titleMatches && authorMatches) {
        return true;
      }
    }

    if (normalizedTitle === normalizedQuery || normalizedQuery === normalizedTitle) {
      return true;
    }

    if (
      normalizedTitle.indexOf(normalizedQuery) === 0 &&
      normalizedQuery.length >= Math.max(4, Math.floor(normalizedTitle.length * 0.6))
    ) {
      return true;
    }

    return normalizedAuthors === normalizedQuery;
  }

  function prioritizeHighConfidenceMatch(books, query) {
    if (!Array.isArray(books) || books.length < 2) return books || [];

    for (var i = 0; i < books.length; i++) {
      if (!isHighConfidenceTopResult(books[i], query)) continue;
      if (i === 0) return books;
      return [books[i]].concat(books.slice(0, i), books.slice(i + 1));
    }

    return books;
  }

  function getGutenbergBookLink(book) {
    if (!book || !book.formats) return null;

    return book.formats["text/html"] || book.formats["text/plain; charset=utf-8"] || book.formats["application/epub+zip"] || null;
  }

  function mapGutenbergBook(book) {
    return {
      title: book && book.title ? book.title : "Untitled",
      authors:
        book && Array.isArray(book.authors) && book.authors.length > 0
          ? book.authors
              .map(function (author) {
                return author && author.name ? author.name : null;
              })
              .filter(Boolean)
              .join(", ")
          : "Unknown author",
      link: getGutenbergBookLink(book),
    };
  }

  function isEnglishGutenbergBook(book) {
    var languages = book && Array.isArray(book.languages) ? book.languages : [];
    return !!(book && book.title && hasEnglishLanguage(languages));
  }

  async function fetchGutenbergBooksByQuery(query) {
    var response = await fetch("https://gutendex.com/books/?search=" + encodeURIComponent(query));
    if (!response.ok) {
      throw new Error("Request failed");
    }

    var data = await response.json();
    var results = Array.isArray(data && data.results) ? data.results : [];
    return results.filter(isEnglishGutenbergBook).map(mapGutenbergBook);
  }

  async function searchGutenberg(queries, rawQuery) {
    var books = [];
    var queryUsed = queries[0] || "";

    for (var i = 0; i < queries.length; i++) {
      queryUsed = queries[i];
      try {
        books = await fetchGutenbergBooksByQuery(queryUsed);
      } catch (error) {
        books = [];
      }

      if (books.length > 0) {
        books = prioritizeHighConfidenceMatch(books, rawQuery || queryUsed);
        break;
      }
    }

    return {
      sourceId: "gutenberg",
      sourceName: "Gutenberg",
      books: books,
      queryUsed: queryUsed,
    };
  }

  function getOpenLibraryBookLink(book) {
    if (book && Array.isArray(book.ia) && book.ia.length > 0) {
      return "https://archive.org/details/" + encodeURIComponent(book.ia[0]);
    }

    if (book && book.key) {
      return "https://openlibrary.org" + book.key;
    }

    if (book && Array.isArray(book.edition_key) && book.edition_key.length > 0) {
      return "https://openlibrary.org/books/" + encodeURIComponent(book.edition_key[0]);
    }

    return null;
  }

  function mapOpenLibraryBook(book) {
    return {
      title: book && book.title ? book.title : "Untitled",
      authors:
        book && Array.isArray(book.author_name) && book.author_name.length > 0
          ? book.author_name.filter(Boolean).join(", ")
          : "Unknown author",
      link: getOpenLibraryBookLink(book),
    };
  }

  function isEnglishOpenLibraryBook(book) {
    var hasPublicEbookAccess = book && book.ebook_access === "public";
    var hasUsableIdentifier = book && (book.key || (Array.isArray(book.edition_key) && book.edition_key.length > 0));
    var languages = book && Array.isArray(book.language) ? book.language : [];
    return !!(hasPublicEbookAccess && book && book.title && hasUsableIdentifier && hasEnglishLanguage(languages));
  }

  async function fetchOpenLibraryBooksByQuery(query) {
    var params = new URLSearchParams({
      q: query,
      ebook_access: "public",
      limit: "25",
    });
    var response = await fetch("https://openlibrary.org/search.json?" + params.toString());
    if (!response.ok) {
      throw new Error("Request failed");
    }

    var data = await response.json();
    var docs = Array.isArray(data && data.docs) ? data.docs : [];

    return docs
      .filter(function (book) {
        return isEnglishOpenLibraryBook(book);
      })
      .map(mapOpenLibraryBook);
  }

  async function searchOpenLibrary(queries, rawQuery) {
    var books = [];
    var queryUsed = queries[0] || "";

    for (var i = 0; i < queries.length; i++) {
      queryUsed = queries[i];
      try {
        books = await fetchOpenLibraryBooksByQuery(queryUsed);
      } catch (error) {
        books = [];
      }

      if (books.length > 0) {
        books = prioritizeHighConfidenceMatch(books, rawQuery || queryUsed);
        break;
      }
    }

    return {
      sourceId: "open-library",
      sourceName: "Open Library",
      books: books,
      queryUsed: queryUsed,
    };
  }

  function getSourceById(sourceId) {
    for (var i = 0; i < SOURCES.length; i++) {
      if (SOURCES[i].id === sourceId) return SOURCES[i];
    }
    return null;
  }

  function getSourceResult(sourceId) {
    var source = getSourceById(sourceId);
    var sourceResult = resultState.sourceResults[sourceId];
    if (sourceResult && Array.isArray(sourceResult.books)) {
      return sourceResult;
    }

    return {
      sourceId: source ? source.id : sourceId,
      sourceName: source ? source.name : sourceId,
      books: [],
      queryUsed: "",
    };
  }

  function buildResultRow(book, sourceName, otherResultsCell) {
    var title = escapeHtml(book && book.title ? book.title : "Untitled");
    var authors = escapeHtml(getBookAuthors(book));
    var link = book && book.link ? book.link : null;
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
      escapeHtml(sourceName) +
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

  function buildNoResultsRow(sourceName) {
    return (
      "<tr>" +
      "<td>🔴 No results found</td>" +
      "<td>—</td>" +
      "<td>" +
      escapeHtml(sourceName) +
      "</td>" +
      "<td>—</td>" +
      "<td>0</td>" +
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

  function renderSummaryResults() {
    var rows = SOURCES.map(function (source) {
      var sourceResult = getSourceResult(source.id);
      if (sourceResult.books.length === 0) {
        return buildNoResultsRow(source.name);
      }

      var topResult = sourceResult.books[0];
      var otherResultsCount = Math.max(sourceResult.books.length - 1, 0);
      var otherResultsHtml =
        otherResultsCount > 0
          ? '<a href="#" data-action="show-all-results" data-source-id="' +
            escapeHtml(source.id) +
            '">' +
            otherResultsCount +
            "</a>"
          : "0";

      return buildResultRow(topResult, source.name, otherResultsHtml);
    }).join("");

    resultsRoot.innerHTML = buildResultsTable(rows);
  }

  function renderFullResultsForSource(sourceId) {
    var source = getSourceById(sourceId);
    var sourceResult = getSourceResult(sourceId);
    if (!source || sourceResult.books.length === 0) {
      renderSummaryResults();
      return;
    }

    var rows = sourceResult.books
      .map(function (book, index) {
        var otherResultsCount = Math.max(sourceResult.books.length - 1, 0);
        var otherResultsCell = index === 0 ? String(otherResultsCount) : "—";
        return buildResultRow(book, source.name, otherResultsCell);
      })
      .join("");

    var backButtonHtml = '<button type="button" class="results-back-button" data-action="show-summary">Back</button>';
    var resultsContextHtml =
      '<p class="results-context">Showing all ' +
      escapeHtml(source.name) +
      ' results for "' +
      escapeHtml(sourceResult.queryUsed || input.value) +
      '".</p>';
    resultsRoot.innerHTML = backButtonHtml + resultsContextHtml + buildResultsTable(rows);
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
      var searchResults = await Promise.all([searchGutenberg(queries, rawQuery), searchOpenLibrary(queries, rawQuery)]);
      resultState.sourceResults = {};
      searchResults.forEach(function (sourceResult) {
        resultState.sourceResults[sourceResult.sourceId] = sourceResult;
      });
      renderSummaryResults();
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
      var sourceId = showAllLink.getAttribute("data-source-id");
      renderFullResultsForSource(sourceId);
      return;
    }

    var showSummaryButton = target.closest('[data-action="show-summary"]');
    if (showSummaryButton) {
      event.preventDefault();
      renderSummaryResults();
    }
  });
})();
