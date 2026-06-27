const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");
const header = document.querySelector("[data-header]");
const year = document.querySelector("[data-year]");
const form = document.querySelector(".contact-form");

if (year) {
  year.textContent = new Date().getFullYear();
}

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target.matches("a")) {
      navLinks.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
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

async function loadBlogPosts() {
  if (!blogPreview) return;

  try {
    const response = await fetch("posts.json");

    if (!response.ok) {
      throw new Error("Could not load posts.json");
    }

    const posts = await response.json();

    posts.sort((a, b) => new Date(b.date) - new Date(a.date));

    const latestPost = posts[0];
    const otherPosts = posts.slice(1, 5);

    blogPreview.innerHTML = `
      <a class="featured-card blog-card-link is-visible" href="${latestPost.url}">
        <span class="tag">${latestPost.category}</span>
        <h3>${latestPost.title}</h3>
        <p>${latestPost.summary}</p>
        <p><strong>${formatPostDate(latestPost.date)}</strong></p>
        <span class="text-link">Read More</span>
      </a>

      ${otherPosts
        .map(
          (post) => `
            <a class="small-card blog-card-link is-visible" href="${post.url}">
              <span>${post.category}</span>
              <h3>${post.title}</h3>
              <p>${post.summary}</p>
              <p><strong>${formatPostDate(post.date)}</strong></p>
            </a>
          `
        )
        .join("")}
    `;
  } catch (error) {
    console.warn("Blog posts could not be loaded.", error);
  }
}

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
