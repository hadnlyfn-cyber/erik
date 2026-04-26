const config = window.APP_CONFIG ?? {};
const STORAGE_KEY = "erik-barber-site-state-v2";
const rewardPerVisit = config.rewardPerVisit ?? 500;
const ADMIN_LOGIN = "erik";
const ADMIN_PASSWORD = "erik2008";

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
  adminRoot: document.getElementById("admin-root"),
  toastStack: document.getElementById("toast-stack"),
  rouletteModal: document.getElementById("roulette-modal"),
  rouletteWheel: document.getElementById("roulette-wheel"),
  rouletteResult: document.getElementById("roulette-result"),
  bonusCounters: [...document.querySelectorAll("[data-bonus-balance]")],
};

const works = config.galleries?.works ?? [];
const diplomas = config.galleries?.diplomas ?? [];
const rewards = config.rewards ?? [];

const defaultState = {
  profiles: [],
  currentProfileId: null,
  reviews: [],
  events: [],
  hasDismissedRegistration: false,
};

let state = loadState();
let adminUnlocked = false;
let rouletteRotation = 0;
let rouletteBusy = false;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch (error) {
    console.warn("Не удалось прочитать сохраненное состояние.", error);
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getCurrentProfile() {
  return state.profiles.find((profile) => profile.id === state.currentProfileId) ?? null;
}

function getProfileById(profileId) {
  return state.profiles.find((profile) => profile.id === profileId) ?? null;
}

function getProfileEvents(profileId) {
  return state.events
    .filter((event) => event.profileId === profileId)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
}

function setBodyOverlayState() {
  const hasOpenPanel = document.querySelector(".panel.is-open");
  const hasVisibleModal = document.querySelector(".modal.is-visible");
  document.body.classList.toggle("overlay-open", Boolean(hasOpenPanel || hasVisibleModal));
}

function openPanel(panelId) {
  closeAllPanels();
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.classList.add("is-open");
  panel.setAttribute("aria-hidden", "false");
  setBodyOverlayState();
}

function closePanel(panel) {
  panel.classList.remove("is-open");
  panel.setAttribute("aria-hidden", "true");
  setBodyOverlayState();
}

function closeAllPanels() {
  document.querySelectorAll(".panel.is-open").forEach((panel) => {
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
  });
  setBodyOverlayState();
}

function showModal(modal, visible) {
  modal.classList.toggle("is-visible", visible);
  setBodyOverlayState();
}

function showRegistrationModal(force = false) {
  const shouldShow = force || (!getCurrentProfile() && !state.hasDismissedRegistration);
  showModal(dom.registrationModal, shouldShow);
}

function showToast(title, message) {
  const toast = document.createElement("article");
  toast.className = "toast";
  toast.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
  dom.toastStack.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3800);
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
  return String(value).replace(/[^\d+]/g, "").trim();
}

function maskPhone(phone) {
  if (!phone) return "Без номера";
  const clean = phone.replace(/[^\d]/g, "");
  if (clean.length < 4) return phone;
  return `+${clean.slice(0, 1)} ${clean.slice(1, 4)} *** ** ${clean.slice(-2)}`;
}

function ensureProfile() {
  if (getCurrentProfile()) return true;
  showRegistrationModal(true);
  showToast("Нужна регистрация", "Сначала зарегистрируй номер телефона, чтобы сохранить бонусы.");
  return false;
}

function createOrActivateProfile(phoneValue) {
  const phone = sanitizePhone(phoneValue);
  if (!phone) {
    showToast("Номер не найден", "Укажи корректный номер телефона.");
    return;
  }

  const existing = state.profiles.find((profile) => profile.phone === phone);
  if (existing) {
    state.currentProfileId = existing.id;
    state.hasDismissedRegistration = true;
    saveState();
    render();
    showModal(dom.registrationModal, false);
    showToast("Кабинет найден", "Мы привязали этот браузер к уже существующему номеру.");
    return;
  }

  const profile = {
    id: crypto.randomUUID(),
    phone,
    bonusBalance: 0,
    visitCount: 0,
    createdAt: new Date().toISOString(),
  };

  state.profiles.unshift(profile);
  state.currentProfileId = profile.id;
  state.hasDismissedRegistration = true;
  createEvent(profile.id, {
    title: "Кабинет создан",
    description: "Профиль зарегистрирован по номеру телефона.",
    delta: 0,
    kind: "info",
  });
  saveState();
  render();
  showModal(dom.registrationModal, false);
  showToast("Кабинет создан", "Теперь бонусы и история операций будут сохраняться.");
}

function createEvent(profileId, { title, description, delta = 0, kind = "info" }) {
  state.events.unshift({
    id: crypto.randomUUID(),
    profileId,
    title,
    description,
    delta,
    kind,
    createdAt: new Date().toISOString(),
  });
}

function updateProfile(profileId, updater) {
  state.profiles = state.profiles.map((profile) => {
    if (profile.id !== profileId) return profile;
    return updater(profile);
  });
}

function addReview({ author, rating, text }) {
  state.reviews.unshift({
    id: crypto.randomUUID(),
    author: author.trim(),
    rating: Number(rating),
    text: text.trim(),
    createdAt: new Date().toISOString(),
  });
  saveState();
  renderReviews();
  renderAdmin();
  showToast("Отзыв отправлен", "Спасибо. Отзыв появился на сайте.");
}

function deleteReview(reviewId) {
  state.reviews = state.reviews.filter((review) => review.id !== reviewId);
  saveState();
  renderReviews();
  renderAdmin();
  showToast("Отзыв удален", "Запись исчезла из публичного блока отзывов.");
}

function addVisitReward(profileId) {
  updateProfile(profileId, (profile) => ({
    ...profile,
    visitCount: profile.visitCount + 1,
    bonusBalance: profile.bonusBalance + rewardPerVisit,
  }));
  createEvent(profileId, {
    title: "Начисление после визита",
    description: "Подтвержден визит со статусом «Клиент пришел».",
    delta: rewardPerVisit,
    kind: "earned",
  });
  saveState();
  render();
  renderAdmin();
}

function addManualAdjustment(profileId, delta, title) {
  const numericDelta = Number(delta);
  updateProfile(profileId, (profile) => ({
    ...profile,
    bonusBalance: Math.max(0, profile.bonusBalance + numericDelta),
  }));
  createEvent(profileId, {
    title,
    description: numericDelta >= 0 ? "Ручное начисление из админ-панели." : "Ручное списание из админ-панели.",
    delta: numericDelta,
    kind: numericDelta >= 0 ? "earned" : "spent",
  });
  saveState();
  render();
  renderAdmin();
}

function redeemReward(reward) {
  if (!ensureProfile()) return;
  if (rouletteBusy) return;

  const profile = getCurrentProfile();
  if (!profile) return;

  if (profile.bonusBalance < reward.price) {
    showToast("Недостаточно бонусов", `Для награды «${reward.title}» нужно ${reward.price} бонусов.`);
    return;
  }

  updateProfile(profile.id, (current) => ({
    ...current,
    bonusBalance: current.bonusBalance - reward.price,
  }));
  createEvent(profile.id, {
    title: `Списание: ${reward.title}`,
    description: "Операция сохранена. Для подтверждения покажи мастеру историю начислений и списаний.",
    delta: -reward.price,
    kind: "spent",
  });

  saveState();
  render();

  if (reward.type === "roulette") {
    startRoulette(profile.id);
    return;
  }

  showToast("Бонусы списаны", "Открой кабинет и покажи мастеру историю списаний для подтверждения.");
}

function pickRoulettePrize() {
  const prizes = [
    { label: "20% скидка на стрижку", weight: 80, segmentIndex: 0 },
    { label: "50% скидка на стрижку", weight: 10, segmentIndex: 1 },
    { label: "80% скидка на стрижку", weight: 9, segmentIndex: 2 },
    { label: "100% скидка на стрижку", weight: 1, segmentIndex: 3 },
  ];

  const total = prizes.reduce((sum, prize) => sum + prize.weight, 0);
  let roll = Math.random() * total;

  for (const prize of prizes) {
    roll -= prize.weight;
    if (roll <= 0) return prize;
  }

  return prizes[0];
}

function startRoulette(profileId) {
  const prize = pickRoulettePrize();
  const targetAngle = (360 - prize.segmentIndex * 90) % 360;
  rouletteRotation += 5 * 360 + targetAngle + 12;
  rouletteBusy = true;

  dom.rouletteResult.textContent = "Колесо крутится...";
  dom.rouletteWheel.style.transition = "none";
  dom.rouletteWheel.style.transform = `rotate(${rouletteRotation - (5 * 360 + targetAngle + 12)}deg)`;
  showModal(dom.rouletteModal, true);

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      dom.rouletteWheel.style.transition = "transform 3.8s cubic-bezier(0.12, 0.72, 0.14, 1)";
      dom.rouletteWheel.style.transform = `rotate(${rouletteRotation}deg)`;
    });
  });

  window.setTimeout(() => {
    createEvent(profileId, {
      title: `Выигрыш: ${prize.label}`,
      description: "Результат рулетки сохранен в истории операций.",
      delta: 0,
      kind: "info",
    });
    saveState();
    render();
    dom.rouletteResult.textContent = `Твой приз: ${prize.label}`;
    rouletteBusy = false;
    showToast("Рулетка завершена", prize.label);

    window.setTimeout(() => {
      showModal(dom.rouletteModal, false);
    }, 1300);
  }, 3900);
}

function renderGallery(items, target) {
  target.innerHTML = "";

  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "gallery-card";
    card.innerHTML = `
      <div class="gallery-card__media">
        <img src="${item.image}" alt="${item.title}" loading="lazy" />
      </div>
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

  rewards.forEach((reward) => {
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
        <button class="primary-button reward-button" type="button">Списать бонусы</button>
      </div>
    `;

    card.querySelector("button").addEventListener("click", () => redeemReward(reward));
    card.querySelector("img").addEventListener("error", (event) => {
      event.currentTarget.style.opacity = "0.45";
    });

    dom.shopGrid.appendChild(card);
  });
}

function renderReviews() {
  dom.reviewsGrid.innerHTML = "";

  if (!state.reviews.length) {
    dom.reviewsGrid.innerHTML = `<div class="admin-empty">Пока отзывов нет. Первый отзыв можно оставить прямо на сайте.</div>`;
    return;
  }

  state.reviews
    .slice()
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .forEach((review) => {
      const card = document.createElement("article");
      card.className = "review-card";
      card.innerHTML = `
        <div class="review-card__head">
          <div>
            <div class="review-card__author">${review.author}</div>
            <div>${formatDate(review.createdAt)}</div>
          </div>
          <div class="review-card__stars">${"★".repeat(review.rating)}</div>
        </div>
        <p>${review.text}</p>
      `;
      dom.reviewsGrid.appendChild(card);
    });
}

function renderAccount() {
  const profile = getCurrentProfile();

  dom.bonusCounters.forEach((element) => {
    element.textContent = String(profile?.bonusBalance ?? 0);
  });

  if (!profile) {
    dom.accountSummary.innerHTML = `
      <div class="account-profile">
        <h3 class="account-profile__name">Кабинет еще не создан</h3>
        <p>Зарегистрируй номер телефона, чтобы бонусы и история операций сохранялись.</p>
      </div>
      <div class="account-actions">
        <button class="primary-button" type="button" id="account-register-button">Зарегистрироваться</button>
        <a class="secondary-button" href="${config.yclientsUrl}" target="_blank" rel="noreferrer">Записаться</a>
      </div>
    `;
    dom.eventList.innerHTML = `<article class="event-item"><div class="event-item__copy"><span class="event-item__title">История пуста</span><span class="event-item__meta">После регистрации и первых операций события появятся здесь.</span></div><span class="event-item__value">0</span></article>`;
    dom.accountSummary.querySelector("#account-register-button").addEventListener("click", () => showRegistrationModal(true));
    return;
  }

  const events = getProfileEvents(profile.id);
  const latestRewards = events
    .filter((event) => event.title.startsWith("Выигрыш:") || event.title.startsWith("Списание:"))
    .slice(0, 3);

  dom.accountSummary.innerHTML = `
    <div class="account-profile">
      <h3 class="account-profile__name">${maskPhone(profile.phone)}</h3>
      <div class="account-profile__meta">
        <span>Создан: ${formatDate(profile.createdAt)}</span>
        <span>Подтвержденных визитов: ${profile.visitCount}</span>
      </div>
    </div>
    <div class="account-balance">
      <span>Баланс бонусов</span>
      <strong>${profile.bonusBalance}</strong>
      <span>После визита начисляется ${rewardPerVisit} бонусов</span>
    </div>
    <p>Если списал бонусы на награду, просто покажи мастеру историю начислений и списаний в правой колонке.</p>
    <div class="account-actions">
      <a class="primary-button" href="${config.yclientsUrl}" target="_blank" rel="noreferrer">Записаться снова</a>
      <button class="secondary-button" type="button" id="account-open-shop">Перейти в магазин</button>
    </div>
    <div class="account-reward-list">
      <span>Последние операции:</span>
      ${latestRewards.length ? latestRewards.map((event) => `<span>${event.title}</span>`).join("") : "<span>Пока без наград и списаний.</span>"}
    </div>
  `;

  dom.accountSummary.querySelector("#account-open-shop").addEventListener("click", () => {
    const accountPanel = document.getElementById("account-panel");
    if (accountPanel.classList.contains("is-open")) {
      closePanel(accountPanel);
    }
    openPanel("shop-panel");
  });

  dom.eventList.innerHTML = events.length
    ? events
        .map(
          (event) => `
            <article class="event-item">
              <div class="event-item__copy">
                <span class="event-item__title">${event.title}</span>
                <span class="event-item__meta">${event.description} • ${formatDateTime(event.createdAt)}</span>
              </div>
              <span class="event-item__value ${event.delta < 0 ? "is-negative" : ""}">
                ${event.delta > 0 ? `+${event.delta}` : event.delta}
              </span>
            </article>
          `,
        )
        .join("")
    : `<article class="event-item"><div class="event-item__copy"><span class="event-item__title">История пуста</span><span class="event-item__meta">Начисления и списания появятся здесь после первых операций.</span></div><span class="event-item__value">0</span></article>`;
}

function renderAdmin() {
  if (!adminUnlocked) {
    dom.adminRoot.innerHTML = `
      <form id="admin-login-form" class="stack-form">
        <label>
          <span>Логин</span>
          <input type="text" name="login" placeholder="Логин" required />
        </label>
        <label>
          <span>Пароль</span>
          <input type="password" name="password" placeholder="Пароль" required />
        </label>
        <button class="primary-button primary-button--full" type="submit">Войти</button>
      </form>
    `;

    dom.adminRoot.querySelector("#admin-login-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const login = String(formData.get("login") || "");
      const password = String(formData.get("password") || "");

      if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
        adminUnlocked = true;
        renderAdmin();
        showToast("Вход выполнен", "Админ-панель открыта.");
        return;
      }

      showToast("Ошибка входа", "Проверь логин и пароль.");
    });
    return;
  }

  const profileOptions = state.profiles
    .map((profile) => `<option value="${profile.id}">${maskPhone(profile.phone)}</option>`)
    .join("");

  dom.adminRoot.innerHTML = `
    <div class="admin-layout">
      <div class="admin-toolbar">
        <p>Через админ-панель можно начислять бонусы, отмечать визиты и удалять отзывы.</p>
        <button class="ghost-button ghost-button--small" type="button" id="admin-logout">Выйти</button>
      </div>

      <div class="admin-cards">
        <section class="admin-card">
          <h3>Операции по бонусам</h3>
          <form id="admin-event-form" class="stack-form">
            <label>
              <span>Клиент</span>
              <select class="admin-select" name="profileId" ${state.profiles.length ? "" : "disabled"}>
                ${profileOptions || `<option value="">Нет профилей</option>`}
              </select>
            </label>
            <div class="admin-grid">
              <label>
                <span>Действие</span>
                <select class="admin-select" name="actionType" ${state.profiles.length ? "" : "disabled"}>
                  <option value="visit">Подтвержденный визит (+500)</option>
                  <option value="bonus">Ручное начисление</option>
                  <option value="spend">Ручное списание</option>
                </select>
              </label>
              <label>
                <span>Бонусы</span>
                <input class="admin-input" type="number" min="1" name="points" value="500" ${state.profiles.length ? "" : "disabled"} />
              </label>
            </div>
            <label>
              <span>Название операции</span>
              <input class="admin-input" type="text" name="title" placeholder="Например, Начисление вручную" ${state.profiles.length ? "" : "disabled"} />
            </label>
            <button class="primary-button primary-button--full" type="submit" ${state.profiles.length ? "" : "disabled"}>Сохранить операцию</button>
          </form>
        </section>

        <section class="admin-card">
          <h3>Отзывы</h3>
          <div class="admin-review-list" id="admin-review-list"></div>
        </section>
      </div>

      <section class="admin-card">
        <h3>Профили клиентов</h3>
        <div class="admin-profile-list" id="admin-profile-list"></div>
      </section>
    </div>
  `;

  dom.adminRoot.querySelector("#admin-logout").addEventListener("click", () => {
    adminUnlocked = false;
    renderAdmin();
    showToast("Выход выполнен", "Админ-панель закрыта.");
  });

  const adminEventForm = dom.adminRoot.querySelector("#admin-event-form");
  adminEventForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const profileId = String(formData.get("profileId") || "");
    const actionType = String(formData.get("actionType") || "visit");
    const title = String(formData.get("title") || "").trim();
    const points = Math.abs(Number(formData.get("points") || 0));

    if (!profileId) {
      showToast("Нет клиента", "Сначала нужен хотя бы один зарегистрированный профиль.");
      return;
    }

    if (actionType === "visit") {
      addVisitReward(profileId);
      showToast("Визит подтвержден", "Клиенту начислено 500 бонусов.");
      return;
    }

    if (!points) {
      showToast("Нет бонусов", "Укажи количество бонусов для ручной операции.");
      return;
    }

    const delta = actionType === "bonus" ? points : -points;
    addManualAdjustment(profileId, delta, title || (delta > 0 ? "Ручное начисление" : "Ручное списание"));
    showToast("Операция сохранена", "Изменение сразу появилось в кабинете клиента.");
  });

  const reviewList = dom.adminRoot.querySelector("#admin-review-list");
  if (!state.reviews.length) {
    reviewList.innerHTML = `<div class="admin-empty">Отзывов пока нет.</div>`;
  } else {
    reviewList.innerHTML = state.reviews
      .slice()
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
      .map(
        (review) => `
          <article class="admin-review-card">
            <div class="admin-review-card__title">${review.author}</div>
            <div class="admin-review-card__meta">${formatDate(review.createdAt)} • ${"★".repeat(review.rating)}</div>
            <div class="admin-review-card__meta">${review.text}</div>
            <div class="admin-review-card__actions">
              <button class="admin-review-card__button" type="button" data-review-delete="${review.id}">Удалить</button>
            </div>
          </article>
        `,
      )
      .join("");
  }

  reviewList.querySelectorAll("[data-review-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteReview(button.dataset.reviewDelete));
  });

  const profileList = dom.adminRoot.querySelector("#admin-profile-list");
  if (!state.profiles.length) {
    profileList.innerHTML = `<div class="admin-empty">Пока никто не зарегистрировался.</div>`;
  } else {
    profileList.innerHTML = state.profiles
      .map((profile) => {
        const isCurrent = profile.id === state.currentProfileId;
        return `
          <article class="admin-profile-card">
            <div class="admin-profile-card__title">${maskPhone(profile.phone)}</div>
            <div class="admin-profile-card__meta">Баланс: ${profile.bonusBalance} • Визитов: ${profile.visitCount}</div>
            <div class="admin-profile-card__meta">Создан: ${formatDate(profile.createdAt)}</div>
            <div class="admin-profile-card__actions">
              <button class="admin-profile-card__button" type="button" data-admin-activate="${profile.id}">
                ${isCurrent ? "Текущий профиль" : "Сделать текущим"}
              </button>
              <button class="admin-profile-card__button" type="button" data-admin-visit="${profile.id}">+500 за визит</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  profileList.querySelectorAll("[data-admin-activate]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentProfileId = button.dataset.adminActivate;
      saveState();
      render();
      renderAdmin();
      showToast("Профиль переключен", "Этот клиент теперь открыт как текущий на сайте.");
    });
  });

  profileList.querySelectorAll("[data-admin-visit]").forEach((button) => {
    button.addEventListener("click", () => {
      addVisitReward(button.dataset.adminVisit);
      showToast("Визит подтвержден", "Бонусы начислены через админ-панель.");
    });
  });
}

function render() {
  renderGallery(works, dom.worksGrid);
  renderGallery(diplomas, dom.diplomasGrid);
  renderShop();
  renderReviews();
  renderAccount();
  renderAdmin();
  showRegistrationModal();
}

function bindStaticEvents() {
  document.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => openPanel(button.dataset.open));
  });

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = button.closest(".panel");
      if (panel) closePanel(panel);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllPanels();
      if (!rouletteBusy) {
        showModal(dom.rouletteModal, false);
      }
      showModal(dom.registrationModal, false);
    }
  });

  dom.registrationForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    createOrActivateProfile(String(formData.get("phone") || ""));
    event.currentTarget.reset();
  });

  dom.dismissRegistration.addEventListener("click", () => {
    state.hasDismissedRegistration = true;
    saveState();
    showModal(dom.registrationModal, false);
  });

  dom.reviewForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const author = String(formData.get("author") || "").trim();
    const text = String(formData.get("text") || "").trim();
    const rating = String(formData.get("rating") || "5");

    if (!author || !text) {
      showToast("Не хватает данных", "Заполни имя и сам отзыв.");
      return;
    }

    addReview({ author, text, rating });
    event.currentTarget.reset();
  });
}

bindStaticEvents();
render();
