const config = window.APP_CONFIG ?? {};
const STORAGE_KEY = "erik-barber-site-state";
const rewardPerVisit = config.rewardPerVisit ?? 500;

const dom = {
  registrationModal: document.getElementById("registration-modal"),
  registrationForm: document.getElementById("registration-form"),
  dismissRegistration: document.getElementById("dismiss-registration"),
  reviewForm: document.getElementById("review-form"),
  worksGrid: document.getElementById("works-grid"),
  diplomasGrid: document.getElementById("diplomas-grid"),
  shopGrid: document.getElementById("shop-grid"),
  reviewsGrid: document.getElementById("reviews-grid"),
  accountSummary: document.getElementById("account-summary"),
  eventList: document.getElementById("event-list"),
  requestList: document.getElementById("request-list"),
  seedVisitButton: document.getElementById("seed-visit-button"),
  toastStack: document.getElementById("toast-stack"),
  bonusCounters: [...document.querySelectorAll("[data-bonus-balance]")],
};

const fallbackReviews = config.reviews ?? [];
const fallbackRewards = config.rewards ?? [];
const fallbackWorks = config.galleries?.works ?? [];
const fallbackDiplomas = config.galleries?.diplomas ?? [];

const initialState = {
  profile: null,
  reviews: fallbackReviews,
  events: [],
  requests: [],
  hasDismissedRegistration: false,
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return structuredClone(initialState);
    }
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(initialState),
      ...parsed,
      reviews: parsed.reviews?.length ? parsed.reviews : fallbackReviews,
      events: parsed.events ?? [],
      requests: parsed.requests ?? [],
    };
  } catch (error) {
    console.warn("State reset because it could not be parsed.", error);
    return structuredClone(initialState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function openPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.classList.add("is-open");
  panel.setAttribute("aria-hidden", "false");
}

function closePanel(panel) {
  panel.classList.remove("is-open");
  panel.setAttribute("aria-hidden", "true");
}

function closeAllPanels() {
  document.querySelectorAll(".panel.is-open").forEach((panel) => closePanel(panel));
}

function showRegistrationModal(force = false) {
  const shouldShow = force || (!state.profile && !state.hasDismissedRegistration);
  dom.registrationModal.classList.toggle("is-visible", shouldShow);
}

function showToast(title, message) {
  const toast = document.createElement("article");
  toast.className = "toast";
  toast.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
  dom.toastStack.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3800);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateString));
}

function formatDateTime(dateString) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function sanitizePhone(value) {
  return value.replace(/[^\d+]/g, "").trim();
}

function ensureProfile() {
  if (state.profile) return true;
  showRegistrationModal(true);
  showToast("Нужна регистрация", "Сначала создайте кабинет, чтобы сохранялись бонусы и заявки.");
  return false;
}

function createProfile({ name, phone, email }) {
  state.profile = {
    id: `erik-${Date.now()}`,
    name: name.trim(),
    phone: sanitizePhone(phone),
    email: email.trim(),
    bonusBalance: 0,
    visitCount: 0,
    createdAt: new Date().toISOString(),
  };
  state.events = [
    {
      id: crypto.randomUUID(),
      type: "info",
      title: "Кабинет создан",
      description: "Профиль готов. После статуса визита бонусы будут начисляться автоматически.",
      value: 0,
      createdAt: new Date().toISOString(),
    },
  ];
  saveState();
  render();
  showRegistrationModal(false);
  showToast("Профиль создан", "Теперь бонусы, награды и отзывы будут сохраняться в кабинете.");
}

function addReview({ author, rating, text }) {
  const review = {
    id: crypto.randomUUID(),
    author: author.trim(),
    rating: Number(rating),
    text: text.trim(),
    date: formatDate(new Date().toISOString()),
  };
  state.reviews = [review, ...state.reviews];
  saveState();
  renderReviews();
  showToast("Отзыв отправлен", "Спасибо. Блок отзывов обновился сразу на сайте.");
}

function addEvent({ title, description, value = 0, type = "info" }) {
  state.events = [
    {
      id: crypto.randomUUID(),
      title,
      description,
      value,
      type,
      createdAt: new Date().toISOString(),
    },
    ...state.events,
  ];
}

function addRequest({ title, description, status = "Отправлено мастеру", meta = "" }) {
  state.requests = [
    {
      id: crypto.randomUUID(),
      title,
      description,
      status,
      meta,
      createdAt: new Date().toISOString(),
    },
    ...state.requests,
  ];
}

function redeemReward(reward) {
  if (!ensureProfile()) return;

  if (state.profile.bonusBalance < reward.price) {
    showToast("Недостаточно бонусов", `Для награды «${reward.title}» нужно ${reward.price} бонусов.`);
    return;
  }

  state.profile.bonusBalance -= reward.price;
  addEvent({
    title: `Списание: ${reward.title}`,
    description: "Бонусы были списаны автоматически при оформлении награды.",
    value: -reward.price,
    type: "spent",
  });

  if (reward.requestType === "roulette") {
    const prize = spinPrizeWheel();
    addRequest({
      title: "Рулетка активирована",
      description: `Клиент получил приз: ${prize.label}.`,
      meta: "Секретные вероятности скрыты от клиента.",
    });
    addEvent({
      title: `Выигрыш: ${prize.label}`,
      description: "Приз сохранен в кабинете и отправлен в запросы мастеру.",
      value: 0,
      type: "info",
    });
    showToast("Рулетка сыграна", `Поздравляем. Ваш приз: ${prize.label}.`);
  } else {
    addRequest({
      title: reward.title,
      description: "Запрос на награду за бонусы сформирован автоматически.",
      meta: "В боевой версии этот запрос уходит мастеру через backend.",
    });
    showToast("Запрос создан", `Награда «${reward.title}» оформлена, а мастеру отправлен запрос.`);
  }

  saveState();
  render();
}

function spinPrizeWheel() {
  const prizes = [
    { label: "20% скидка на стрижку", weight: 60 },
    { label: "50% скидка на стрижку", weight: 30 },
    { label: "80% скидка на стрижку", weight: 9 },
    { label: "100% скидка на стрижку", weight: 1 },
  ];

  const total = prizes.reduce((sum, prize) => sum + prize.weight, 0);
  let roll = Math.random() * total;

  for (const prize of prizes) {
    roll -= prize.weight;
    if (roll <= 0) return prize;
  }

  return prizes[0];
}

function creditVisitReward() {
  if (!ensureProfile()) return;
  state.profile.visitCount += 1;
  state.profile.bonusBalance += rewardPerVisit;

  addEvent({
    title: "Начисление после визита",
    description: "Симуляция статуса «Клиент пришел» для демо-режима.",
    value: rewardPerVisit,
    type: "earned",
  });

  saveState();
  render();
  showToast("Начислено 500 бонусов", "Демо-кнопка имитирует визит после подтвержденного статуса.");
}

function renderGallery(items, target) {
  target.innerHTML = "";

  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "gallery-card";

    const imageHtml = `
      <div class="gallery-card__media" data-placeholder="${index + 1}">
        <img src="${item.image}" alt="${item.title}" loading="lazy" />
      </div>
    `;

    card.innerHTML = `
      ${imageHtml}
      <div class="gallery-card__body">
        <h3>${item.title}</h3>
        <p>${item.description}</p>
      </div>
    `;

    const media = card.querySelector(".gallery-card__media");
    const image = card.querySelector("img");
    image.addEventListener("error", () => {
      image.remove();
      media.classList.add("is-placeholder");
      media.textContent = `slot ${index + 1}`;
    });

    target.appendChild(card);
  });
}

function renderShop() {
  dom.shopGrid.innerHTML = "";

  fallbackRewards.forEach((reward) => {
    const card = document.createElement("article");
    card.className = "shop-card";
    card.innerHTML = `
      <div class="shop-card__media">
        <img src="${reward.image}" alt="${reward.title}" loading="lazy" />
      </div>
      <div class="shop-card__body">
        <div class="price-row">
          <span>${reward.title}</span>
          <span>${reward.price} бонусов</span>
        </div>
        <p>${reward.description}</p>
        <button class="primary-button reward-button" type="button">Забрать награду</button>
      </div>
    `;

    card.querySelector("button").addEventListener("click", () => redeemReward(reward));
    card.querySelector("img").addEventListener("error", (event) => {
      event.currentTarget.style.opacity = "0.5";
    });

    dom.shopGrid.appendChild(card);
  });
}

function renderReviews() {
  dom.reviewsGrid.innerHTML = "";

  state.reviews.forEach((review) => {
    const card = document.createElement("article");
    card.className = "review-card";
    card.innerHTML = `
      <div class="review-card__head">
        <div>
          <div class="review-card__author">${review.author}</div>
          <div>${review.date}</div>
        </div>
        <div class="review-card__stars">${"★".repeat(review.rating)}</div>
      </div>
      <p>${review.text}</p>
    `;
    dom.reviewsGrid.appendChild(card);
  });
}

function renderAccount() {
  dom.bonusCounters.forEach((element) => {
    element.textContent = String(state.profile?.bonusBalance ?? 0);
  });

  if (!state.profile) {
    dom.accountSummary.innerHTML = `
      <div class="account-profile">
        <h3 class="account-profile__name">Кабинет еще не создан</h3>
        <p>Зарегистрируйтесь, чтобы сохранять бонусы, оставлять отзывы и использовать магазин наград.</p>
      </div>
      <div class="account-actions">
        <button class="primary-button" type="button" id="open-registration-inline">Зарегистрироваться</button>
        <a class="secondary-button" href="${config.yclientsUrl}" target="_blank" rel="noreferrer">Записаться</a>
      </div>
    `;

    dom.accountSummary.querySelector("#open-registration-inline").addEventListener("click", () => showRegistrationModal(true));
  } else {
    dom.accountSummary.innerHTML = `
      <div class="account-profile">
        <h3 class="account-profile__name">${state.profile.name}</h3>
        <div class="account-profile__meta">
          <span>${state.profile.phone}</span>
          <span>${state.profile.email}</span>
          <span>Создан: ${formatDate(state.profile.createdAt)}</span>
        </div>
      </div>
      <div class="account-balance">
        <span>Баланс бонусов</span>
        <strong>${state.profile.bonusBalance}</strong>
        <span>${state.profile.visitCount} подтвержденных визитов</span>
      </div>
      <p>После каждого визита со статусом «Клиент пришел» начисляется ${rewardPerVisit} бонусов. В демо-режиме это можно проверить кнопкой справа.</p>
      <div class="account-actions">
        <a class="primary-button" href="${config.yclientsUrl}" target="_blank" rel="noreferrer">Записаться снова</a>
        <button class="secondary-button" type="button" data-open="shop-panel">Перейти в магазин</button>
      </div>
    `;
  }

  dom.eventList.innerHTML = state.events.length
    ? state.events
        .map(
          (event) => `
            <article class="event-item">
              <div class="event-item__copy">
                <span class="event-item__title">${event.title}</span>
                <span class="event-item__meta">${event.description} • ${formatDateTime(event.createdAt)}</span>
              </div>
              <span class="event-item__value ${event.value < 0 ? "is-negative" : ""}">
                ${event.value > 0 ? `+${event.value}` : event.value}
              </span>
            </article>
          `,
        )
        .join("")
    : `<article class="event-item"><div class="event-item__copy"><span class="event-item__title">Пока пусто</span><span class="event-item__meta">Начисления и списания появятся после визитов и наград.</span></div><span class="event-item__value">0</span></article>`;

  dom.requestList.innerHTML = state.requests.length
    ? state.requests
        .map(
          (request) => `
            <article class="request-item">
              <div class="request-item__copy">
                <span class="request-item__title">${request.title}</span>
                <span class="request-item__meta">${request.description}</span>
                <span class="request-item__meta">${request.meta || ""}</span>
                <span class="request-item__meta">${formatDateTime(request.createdAt)}</span>
              </div>
              <span class="request-item__status">${request.status}</span>
            </article>
          `,
        )
        .join("")
    : `<article class="request-item"><div class="request-item__copy"><span class="request-item__title">Запросов пока нет</span><span class="request-item__meta">Когда клиент оформит награду, здесь появится запись для мастера.</span></div></article>`;

  dom.accountSummary.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => openPanel(button.dataset.open));
  });
}

function render() {
  renderGallery(fallbackWorks, dom.worksGrid);
  renderGallery(fallbackDiplomas, dom.diplomasGrid);
  renderShop();
  renderReviews();
  renderAccount();
  showRegistrationModal();
}

function handleGlobalClicks() {
  document.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => openPanel(button.dataset.open));
  });

  document.querySelectorAll("[data-close]").forEach((element) => {
    element.addEventListener("click", () => {
      const panel = element.closest(".panel");
      if (panel) closePanel(panel);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllPanels();
      showRegistrationModal(false);
    }
  });
}

function bindForms() {
  dom.registrationForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    createProfile({
      name: String(formData.get("name") || ""),
      phone: String(formData.get("phone") || ""),
      email: String(formData.get("email") || ""),
    });
    event.currentTarget.reset();
  });

  dom.dismissRegistration.addEventListener("click", () => {
    state.hasDismissedRegistration = true;
    saveState();
    showRegistrationModal(false);
  });

  dom.reviewForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const author = state.profile?.name || String(formData.get("author") || "").trim();
    const text = String(formData.get("text") || "").trim();

    if (!author || !text) {
      showToast("Не хватает данных", "Заполните имя и сам отзыв.");
      return;
    }

    addReview({
      author,
      rating: String(formData.get("rating") || "5"),
      text,
    });
    event.currentTarget.reset();
  });

  dom.seedVisitButton.addEventListener("click", creditVisitReward);
}

handleGlobalClicks();
bindForms();
render();
