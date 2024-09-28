/**
 * Sets up Justified Gallery.
 */
if (!!$.prototype.justifiedGallery) {
  var options = {
    rowHeight: 140,
    margins: 4,
    lastRow: "justify"
  };
  $(".article-gallery").justifiedGallery(options);
}

$(document).ready(function() {

  /**
   * Shows the responsive navigation menu on mobile.
   */
  $("#header > #nav > ul > .icon").click(function() {
    $("#header > #nav > ul").toggleClass("responsive");
  });
  // Listen for click events on the document. for reveal-text class
  document.addEventListener('click', function(event) {
    if (event.target.classList.contains('reveal-text')) {
      event.target.classList.toggle('active');
    }
  });
  /**
   * Controls the different versions of  the menu in blog post articles 
   * for Desktop, tablet and mobile.
   */
  if ($(".post").length) {
    var menu = $("#menu");
    var nav = $("#menu > #nav");
    var menuIcon = $("#menu-icon, #menu-icon-tablet");

    /**
     * Display the menu on hi-res laptops and desktops.
     */
    if ($(document).width() >= 1440) {
      menu.show();
      menuIcon.addClass("active");
    }

    /**
     * Display the menu if the menu icon is clicked.
     */
    menuIcon.click(function() {
      if (menu.is(":hidden")) {
        menu.show();
        nav.show();
        menuIcon.addClass("active");
      } else {
        menu.hide();
        menuIcon.removeClass("active");
      }
      return false;
    });

    /**
     * Add a scroll listener to the menu to hide/show the nav-+igation links.
     */
    if (menu.length) {
      $(window).on("scroll", function() {
        var topDistance = document.documentElement.scrollTop;

        // hide only the navigation links on desktop
        if (!nav.is(":visible") && topDistance < 100) {
          nav.show();
        } else if (nav.is(":visible") && topDistance > 100) {
          nav.hide();
        }

        // on tablet, hide the navigation icon as well and show a "scroll to top
        // icon" instead
        if ( ! $( "#menu-icon" ).is(":visible") && topDistance < 50 ) {
          $("#menu-icon-tablet").show();
          $("#top-icon-tablet").hide();
        } else if (! $( "#menu-icon" ).is(":visible") && topDistance > 100) {
          $("#menu-icon-tablet").hide();
          $("#top-icon-tablet").show();
        }
      });
    }

    /**
     * Show mobile navigation menu after scrolling upwards,
     * hide it again after scrolling downwards.
     */
    if ($( "#footer-post").length) {
      var lastScrollTop = 0;
      $(window).on("scroll", function() {
        var topDistance = $(window).scrollTop();

        if (topDistance > lastScrollTop){
          // downscroll -> show menu
          $("#footer-post").hide();
        } else {
          // upscroll -> hide menu
          $("#footer-post").show();
        }
        lastScrollTop = topDistance;

        // close all submenu"s on scroll
        $("#nav-footer").hide();
        $("#toc-footer").hide();
        $("#share-footer").hide();

        // show a "navigation" icon when close to the top of the page, 
        // otherwise show a "scroll to the top" icon
        if (topDistance < 50) {
          $("#actions-footer > #top").hide();
        } else if (topDistance > 100) {
          $("#actions-footer > #top").show();
        }
      });
    }

    //
    updateArticleStats();
  }
});


/**
 * Counts words in the given text.
 */
function countWords(htmlContent) {
  // Remove script and style elements
  var text = htmlContent.replace(/<(script|style).*?<\/\1>/gs, '');
  
  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Remove special characters and numbers
  text = text.replace(/[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s]/g, '');
  
  // Split by whitespace and filter out empty strings
  var words = text.trim().split(/\s+/).filter(function(word) {
    return word.length > 0;
  });
  
  return words.length;
}

/**
 * Updates article statistics (word count and reading time).
 */
function updateArticleStats() {
  var $articleContent = $(".content");
  if ($articleContent.length) {
    var htmlContent = $articleContent.html();
    var wordCount = countWords(htmlContent);
    var readingTime = estimateReadingTime(wordCount);

    $(".word-count").text("Words: " + wordCount);
    $(".reading-time").text("Est. reading time: " + readingTime + " min");
  }
}

/**
 * Estimates reading time based on word count.
 */
  function estimateReadingTime(wordCount) {
    var wordsPerMinute = 130;
    return Math.ceil(wordCount / wordsPerMinute);
}

