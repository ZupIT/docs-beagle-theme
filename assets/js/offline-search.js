// Adapted from code by Matt Walters https://www.mattwalters.net/posts/hugo-and-lunr/

(function ($) {
  'use strict';

  $(document).ready(function () {
      const CURRENT_LANGUAGE = $('html').attr('lang');
      const $searchInput = $('.td-search-input');

      const handleSearch = (event) => {
        const WINDOW_WIDTH = $(document).width();

        render($(event.target));

          // Hide keyboard on mobile browser
          if (WINDOW_WIDTH <= 500) {
            $searchInput.blur();
          }
      }

      //
      // Options for popover
      //

      $searchInput.data('html', true);
      $searchInput.data('placement', 'bottom');
      $searchInput.data(
          'template',
          '<div class="popover offline-search-result" role="tooltip"><div class="arrow"></div><h3 class="popover-header"></h3><div class="popover-body"></div></div>'
      );

      //
      // Register handler
      //

      $searchInput.on('change', handleSearch);
      $searchInput.keyup(_.debounce(handleSearch , 500));

      // Prevent reloading page by enter key on sidebar search.
      $searchInput.closest('form').on('submit', () => {
          return false;
      });

      //
      // Lunr
      //

      let idx = null; // Lunr index
      const resultDetails = new Map(); // Will hold the data for the search results (titles and summaries)

      // Set up for an Ajax call to request the JSON data file that is created by Hugo's build process
      $.ajax($searchInput.data('offline-search-index-json-src')).then(
          (data) => {
              idx = lunr(function () {
                  this.ref('ref');
                  this.field('title', { boost: 2 });
                  this.field('body');
                  this.field('language');

                  data.forEach((doc) => {
                      this.add(doc);

                      resultDetails.set(doc.ref, {
                          title: doc.title,
                          excerpt: doc.excerpt,
                          language: doc.language,
                      });
                  });
              });

              $searchInput.trigger('change');
          }
      );

      const render = ($targetSearchInput) => {
          // Dispose the previous result
          $targetSearchInput.popover('dispose');

          //
          // Search
          //

          if (idx === null) {
              return;
          }

          const searchQuery = $targetSearchInput.val();
          if (searchQuery === '') {
              return;
          }

          const results = idx
              .query((q) => {
                  console.log('1Q:', q);

                  const tokens = lunr.tokenizer(searchQuery.toLowerCase());

                  tokens.forEach((token) => {
                      const queryString = token.toString();
                      q.term(queryString, {
                          boost: 100,
                      });
                      q.term(queryString, {
                          wildcard:
                              lunr.Query.wildcard.LEADING |
                              lunr.Query.wildcard.TRAILING,
                          boost: 10,
                      });
                      q.term(queryString, {
                          editDistance: 2,
                      });
                      q.term(`content/${CURRENT_LANGUAGE}`, {
                        field: 'language',
                        presence: lunr.Query.presence.REQUIRED
                      })
                  });
              })
              .slice(
                  0,
                  $targetSearchInput.data('offline-search-max-results')
              );
          

          //
          // Make result html
          //

          const $html = $('<div>');

          $html.append(
              $('<div>')
                  .css({
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '1em',
                  })
                  .append(
                      $('<span>')
                          .text('Search results')
                          .css({ fontWeight: 'bold' })
                  )
                  .append(
                      $('<i>')
                          .addClass('fas fa-times search-result-close-button')
                          .css({
                              cursor: 'pointer',
                          })
                  )
          );

          const $searchResultBody = $('<div>').css({
              maxHeight: `calc(100vh - ${
                  $targetSearchInput.offset().top -
                  $(window).scrollTop() +
                  180
              }px)`,
              overflowY: 'auto',
          });
          $html.append($searchResultBody);

          if (results.length === 0) {
              $searchResultBody.append(
                  $('<p>').text(`No results found for query "${searchQuery}"`)
              );
          } else {
              results.forEach((r) => {
                  const doc = resultDetails.get(r.ref);
                  const href =
                      $searchInput.data('offline-search-base-href') +
                      r.ref.replace(/^\//, '');

                  const $entry = $('<div>').addClass('mt-4');

                  $entry.append(
                      $('<small>').addClass('d-block text-muted').text(r.ref)
                  );

                  $entry.append(
                      $('<a>')
                          .addClass('d-block')
                          .css({
                              fontSize: '1.2rem',
                          })
                          .attr('href', href)
                          .text(doc.title)
                  );

                  $entry.append($('<p>').text(doc.excerpt));

                  $searchResultBody.append($entry);
              });
          }

          $targetSearchInput.on('shown.bs.popover', () => {
              $('.search-result-close-button').on('click', () => {
                  $targetSearchInput.val('');
                  $targetSearchInput.trigger('change');
              });
          });

          $targetSearchInput
              .data('content', $html[0].outerHTML)
              .popover('show');
      };
  });
})(jQuery);