const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");
const header = document.querySelector("[data-header]");
const year = document.querySelector("[data-year]");
const form = document.querySelector(".contact-form");
const nav = document.querySelector(".nav");

if (year) {
  year.textContent = new Date().getFullYear();
}

if (navToggle && navLinks) {

    navToggle.addEventListener("click", () => {

        const open = navLinks.classList.toggle("is-open");

        navToggle.setAttribute("aria-expanded", open);

    });

    navLinks.querySelectorAll("a,button").forEach(item => {

        item.addEventListener("click", () => {

            navLinks.classList.remove("is-open");

            navToggle.setAttribute("aria-expanded","false");

        });

    });

    document.addEventListener("click",(e)=>{

        if(
            !nav.contains(e.target)
        ){

            navLinks.classList.remove("is-open");

            navToggle.setAttribute("aria-expanded","false");

        }

    });

}

if (header) {
  window.addEventListener("scroll", () => {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  });
}

const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = form.querySelector(".form-status");

    if (status) {
      status.textContent = "Sending...";
    }

    try {
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(new FormData(form)).toString(),
      });

      if (!response.ok) throw new Error("Form submission failed");

      form.reset();

      if (status) {
        status.textContent = "Your message has been sent.";
      }
    } catch {
      if (status) {
        status.textContent = "The message could not be sent. Please try again.";
      }
    }
  });
}


const blogPreview = document.querySelector("[data-blog-preview]");

function formatPostDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const blogGrid = document.getElementById("blogPostsGrid");
const blogSearch = document.getElementById("blogSearch");
const blogCategoryFilter = document.getElementById("blogCategoryFilter");
const loadMoreButton = document.getElementById("loadMorePosts");
const blogEmptyMessage = document.getElementById("blogEmptyMessage");

let allBlogPosts = [];
let visiblePostCount = 6;

async function loadBlogPosts() {
  if (!blogGrid) return;

  try {
    const response = await fetch("posts.json");
    allBlogPosts = await response.json();

    allBlogPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

    buildCategoryFilter();
    renderBlogPosts();
  } catch (error) {
    console.error("Could not load blog posts:", error);
    blogGrid.innerHTML = `<p class="blog-error">The grimoire is resting. Try again soon.</p>`;
  }
}

function buildCategoryFilter() {
  if (!blogCategoryFilter) return;

  const categories = [...new Set(allBlogPosts.map(post => post.category).filter(Boolean))];

  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    blogCategoryFilter.appendChild(option);
  });
}

function getFilteredPosts() {
  const searchTerm = blogSearch?.value.toLowerCase().trim() || "";
  const selectedCategory = blogCategoryFilter?.value || "all";

  return allBlogPosts.filter(post => {
    const matchesSearch =
      post.title.toLowerCase().includes(searchTerm) ||
      post.summary.toLowerCase().includes(searchTerm) ||
      post.category.toLowerCase().includes(searchTerm);

    const matchesCategory =
      selectedCategory === "all" || post.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });
}

function renderBlogPosts() {
  const filteredPosts = getFilteredPosts();
  const postsToShow = filteredPosts.slice(0, visiblePostCount);

  blogGrid.innerHTML = "";

  if (blogEmptyMessage) {
    blogEmptyMessage.hidden = filteredPosts.length > 0;
  }

  postsToShow.forEach(post => {
    const article = document.createElement("article");
    article.className = "blog-preview-card reveal is-visible";

    article.innerHTML = `
      <p class="blog-category">${post.category}</p>
      <h3>${post.title}</h3>
      <p class="blog-date">${formatPostDate(post.date)}</p>
      <p>${post.summary}</p>
      <a href="${post.url}" class="text-link">Read entry</a>
    `;

    blogGrid.appendChild(article);
  });

  if (loadMoreButton) {
    loadMoreButton.hidden = visiblePostCount >= filteredPosts.length;
  }
}

function formatPostDate(dateString) {
  const date = new Date(dateString + "T00:00:00");

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

blogSearch?.addEventListener("input", () => {
  visiblePostCount = 6;
  renderBlogPosts();
});

blogCategoryFilter?.addEventListener("change", () => {
  visiblePostCount = 6;
  renderBlogPosts();
});

loadMoreButton?.addEventListener("click", () => {
  visiblePostCount += 6;
  renderBlogPosts();
});

loadBlogPosts();

document.addEventListener("DOMContentLoaded", () => {
  const thresholdGate = document.querySelector("[data-threshold-gate]");
  const enterThreshold = document.querySelector("[data-enter-threshold]");
  const declineThreshold = document.querySelector("[data-decline-threshold]");
  const thresholdQuestion = document.querySelector("[data-threshold-question]");
  const thresholdNote = document.querySelector("[data-threshold-note]");

  const thresholdQuestions = [
    "Are you willing to meet yourself where you are?",
    "What part of yourself is asking to be witnessed?",
    "What would happen if you stopped trying to earn your worth?",
    "Can you cross this threshold without abandoning yourself?",
    "What are you carrying that was never yours?",
    "Are you ready to return to the parts of you that survived?",
    "Can you let this be a place where every part of you is welcome?"
  ];

  if (!thresholdGate) return;

  const hasEnteredThreshold = sessionStorage.getItem("saltThresholdEntered");

  if (hasEnteredThreshold === "true") {
    thresholdGate.classList.add("is-hidden");
    document.body.classList.remove("threshold-locked");
  
    document.querySelectorAll(".reveal").forEach((item) => {
      item.classList.add("is-visible");
    });
  
    return;
  }

  document.body.classList.add("threshold-locked");

  if (thresholdQuestion) {
    thresholdQuestion.textContent =
      thresholdQuestions[Math.floor(Math.random() * thresholdQuestions.length)];
  }

  if (enterThreshold) {
    enterThreshold.addEventListener("click", () => {
      sessionStorage.setItem("saltThresholdEntered", "true");
      thresholdGate.classList.add("is-hidden");
      document.body.classList.remove("threshold-locked");
    });
  }

  if (declineThreshold) {
    declineThreshold.addEventListener("click", () => {
      if (thresholdQuestion) {
        thresholdQuestion.textContent =
          "The threshold will remain. Return when you are ready.";
      }

      if (thresholdNote) {
        thresholdNote.textContent =
          "No path needs to be forced. May you leave gently, and return only if it calls.";
      }

      declineThreshold.textContent = "Remain at the Threshold";
    });
  }
});
