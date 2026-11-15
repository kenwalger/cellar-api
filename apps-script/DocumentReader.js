/**
 * Extracts script text from a Google Docs Body.
 *
 * Works on anything with the Body/Element methods used below (getNumChildren,
 * getChild, getType, getText), so tests can pass simple doubles. It never
 * calls DocumentApp directly and never interprets formatting.
 *
 * Each paragraph becomes one or more text lines: soft line breaks inside a
 * paragraph split it into several lines. `lines[i]` records which document
 * element (1-based body child) line i+1 came from, so parser diagnostics can
 * point back to the document.
 */
var DocumentReader = (function () {
  "use strict";

  const TEXT_ELEMENT_TYPES = ["PARAGRAPH", "LIST_ITEM"];
  // Inline elements that carry no text, so ignoring them loses nothing.
  const IGNORABLE_INLINE_TYPES = ["PAGE_BREAK", "HORIZONTAL_RULE"];
  // Docs may report a soft line break as \r, \n, or a vertical tab.
  const LINE_BREAK = /\r\n|\r|\n|\u000b/;

  /**
   * @param {Body} body The document body (or a test double).
   * @param {{tabCount: number}=} options tabCount > 1 is reported as an error.
   * @returns {{text: string, lines: Object[], elementCount: number, diagnostics: Object[]}}
   */
  function readBody(body, options) {
    const tabCount = options && options.tabCount ? options.tabCount : 1;
    const textLines = [];
    const lines = [];
    const diagnostics = [];
    let listItemCount = 0;
    let firstListElement = null;

    if (tabCount > 1) {
      diagnostics.push(
        diagnostic(
          "MULTIPLE_TABS",
          "error",
          null,
          `The document has ${tabCount} tabs. Only the first tab would be read, so put the whole script in a single tab.`,
        ),
      );
    }

    const elementCount = body.getNumChildren();
    for (let index = 0; index < elementCount; index++) {
      const element = body.getChild(index);
      const elementNumber = index + 1;
      const type = String(element.getType());

      if (TEXT_ELEMENT_TYPES.indexOf(type) === -1) {
        diagnostics.push(
          diagnostic(
            "UNSUPPORTED_ELEMENT",
            "error",
            elementNumber,
            `Document element ${elementNumber} is a ${type}, which can't be read as script text. Replace it with plain paragraphs.`,
          ),
        );
        continue;
      }
      if (type === "LIST_ITEM") {
        listItemCount += 1;
        if (firstListElement === null) {
          firstListElement = elementNumber;
        }
      }

      checkInlineElements(element, elementNumber, diagnostics);

      String(element.getText())
        .split(LINE_BREAK)
        .forEach(function (part, partIndex) {
          textLines.push(part);
          lines.push({ element: elementNumber, partInElement: partIndex + 1 });
        });
    }

    if (listItemCount > 0) {
      const noun = listItemCount === 1 ? "list item" : "list items";
      diagnostics.push(
        diagnostic(
          "LIST_FORMATTING_IGNORED",
          "warning",
          firstListElement,
          `${listItemCount} ${noun} found, starting at document element ${firstListElement}. Their text is read, but bullets and numbering are not.`,
        ),
      );
    }

    return {
      text: textLines.join("\n"),
      lines: lines,
      elementCount: elementCount,
      diagnostics: sortByElement(diagnostics),
    };
  }

  // Reports at most one diagnostic per paragraph: an error if any inline
  // element would lose content, otherwise a warning if one was ignored.
  function checkInlineElements(element, elementNumber, diagnostics) {
    const unsupported = [];
    const ignored = [];
    const count = element.getNumChildren();
    for (let index = 0; index < count; index++) {
      const type = String(element.getChild(index).getType());
      if (type === "TEXT") {
        continue;
      }
      if (IGNORABLE_INLINE_TYPES.indexOf(type) !== -1) {
        ignored.push(type);
      } else {
        unsupported.push(type);
      }
    }
    if (unsupported.length > 0) {
      diagnostics.push(
        diagnostic(
          "UNSUPPORTED_INLINE_ELEMENT",
          "error",
          elementNumber,
          `Document element ${elementNumber} contains ${unsupported.join(", ")}, which can't be read as text. Remove it or replace it with text.`,
        ),
      );
    } else if (ignored.length > 0) {
      diagnostics.push(
        diagnostic(
          "IGNORED_INLINE_ELEMENT",
          "warning",
          elementNumber,
          `Document element ${elementNumber} contains ${ignored.join(", ")}, which is ignored.`,
        ),
      );
    }
  }

  function diagnostic(code, severity, element, message) {
    return { code: code, severity: severity, element: element, message: message };
  }

  // Document-level diagnostics (element null) first, then by element.
  function sortByElement(diagnostics) {
    const key = function (d) {
      return d.element === null ? 0 : d.element;
    };
    return diagnostics
      .map(function (d, index) {
        return { d: d, index: index };
      })
      .sort(function (a, b) {
        return key(a.d) - key(b.d) || a.index - b.index;
      })
      .map(function (entry) {
        return entry.d;
      });
  }

  return { readBody: readBody };
})();
