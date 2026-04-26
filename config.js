window.APP_CONFIG = {
  demoMode: true,
  yclientsUrl: "https://n2154738.yclients.com",
  brandName: "ERIK BARBER",
  rewardPerVisit: 500,
  galleries: {
    works: [
      {
        title: "Fade contour",
        description: "Карточка готова под `work1.jpg`.",
        image: "assets/images/works/work1.jpg",
      },
      {
        title: "Texture crop",
        description: "Карточка готова под `work2.jpg`.",
        image: "assets/images/works/work2.jpg",
      },
      {
        title: "Classic clean",
        description: "Карточка готова под `work3.jpg`.",
        image: "assets/images/works/work3.jpg",
      },
    ],
    diplomas: [
      {
        title: "Сертификат 01",
        description: "Карточка готова под `diplom1.jpg`.",
        image: "assets/images/diplomas/diplom1.jpg",
      },
      {
        title: "Сертификат 02",
        description: "Карточка готова под `diplom2.jpg`.",
        image: "assets/images/diplomas/diplom2.jpg",
      },
    ],
  },
  reviews: [
    {
      author: "Максим",
      rating: 5,
      text: "Очень аккуратная работа, крутая атмосфера и реально современный подход к образу.",
      date: "12 апреля 2026",
    },
    {
      author: "Илья",
      rating: 5,
      text: "Стрижка держит форму, все чисто и быстро. Понравилось, что Эрик слышит запрос, а не делает шаблон.",
      date: "9 апреля 2026",
    },
    {
      author: "Артем",
      rating: 5,
      text: "Сайт и запись удобные, а сама работа выглядит дорого и уверенно.",
      date: "2 апреля 2026",
    },
  ],
  rewards: [
    {
      id: "free-haircut",
      title: "Бесплатная стрижка",
      description: "Полное списание бонусов на одну бесплатную стрижку.",
      price: 2000,
      image: "assets/images/rewards/free-haircut.svg",
      requestType: "service",
    },
    {
      id: "free-beard",
      title: "Бесплатная стрижка бороды",
      description: "Автоматическое списание бонусов и уведомление мастеру о запросе.",
      price: 1500,
      image: "assets/images/rewards/free-beard.svg",
      requestType: "service",
    },
    {
      id: "prize-wheel",
      title: "Колесо рулетка",
      description: "Секретные шансы. Клиент видит только выигранную скидку.",
      price: 1000,
      image: "assets/images/rewards/prize-wheel.svg",
      requestType: "roulette",
    },
  ],
  supabase: {
    url: "",
    anonKey: "",
  },
};
