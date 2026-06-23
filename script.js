const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");
const header = document.querySelector("[data-header]");
const year = document.querySelector("[data-year]");
const form = document.querySelector(".contact-form");

year.textContent = new Date().getFullYear();

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

window.addEventListener("scroll", () => {
  header.classList.toggle("is-scrolled", window.scrollY > 12);
});

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

document.querySelectorAll(".reveal").forEach((item) => observer.observe(item));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = form.querySelector(".form-status");
  status.textContent = "Sending...";

  try {
    const response = await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(new FormData(form)).toString(),
    });

    if (!response.ok) throw new Error("Form submission failed");

    form.reset();
    status.textContent = "Your message has been sent.";
  } catch {
    status.textContent = "The message could not be sent. Please try again.";
  }
});
