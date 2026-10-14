import type { EnRecipe } from "./types";

/** Mains, part 2. A "cup" is the Turkish su bardağı (200 ml). */
export const ana2En: Record<string, EnRecipe> = {
  "barbunya-pilaki": {
    name: "Barbunya pilaki (borlotti beans in olive oil)",
    shortName: "Barbunya pilaki",
    prep: ["Put the borlotti beans to soak"],
    steps: [
      "Boil the soaked beans in fresh water for 30 minutes, until they start to soften, then drain.",
      "Soften the onion and garlic in olive oil and add the diced carrot and potato.",
      "Stir in the tomato paste, then add the beans and enough hot water to cover.",
      "Season with sugar and salt and cook over low heat for 30 minutes.",
      "Serve cold with parsley.",
    ],
  },
  "yesil-mercimek-yemegi": {
    name: "Yeşil mercimek yemeği (green lentil stew)",
    shortName: "Green lentil stew",
    steps: [
      "Rinse the lentils and boil them for 15 minutes; don’t drain.",
      "In another pan, soften the onion and garlic in oil and add the pastes.",
      "Add the fried mixture and the bulgur to the lentils.",
      "Cook for 25 minutes, adding water if needed for a thick stew.",
      "Season with salt and chilli flakes and serve with yoghurt.",
    ],
  },
  "patlican-musakka": {
    name: "Patlıcan musakka (aubergine and mince bake)",
    shortName: "Musakka",
    prep: ["Dice the aubergines and salt them"],
    steps: [
      "Pat dry the salted aubergine, fry it in oil and drain on paper towels.",
      "Fry the onion and add the mince; when its liquid has gone, add the pepper and tomato.",
      "Layer the aubergine and mince in a baking dish.",
      "Loosen the tomato paste in a cup of hot water and pour it over.",
      "Bake at 180°C for 25 minutes.",
    ],
  },
  "tas-kebabi": {
    name: "Tas kebabı (slow-cooked beef stew)",
    shortName: "Tas kebabı",
    steps: [
      "Cook the meat in a pot until it releases its juices and they cook off.",
      "Add the butter and chopped onion and cook until the onion turns translucent.",
      "Add the tomato paste and grated tomato and cook for a few minutes.",
      "Cover with hot water, put the lid on and simmer gently for 1 hour.",
      "When the meat is meltingly tender, season and serve with rice.",
    ],
  },
  "et-sote": {
    name: "Et sote (beef sauté)",
    shortName: "Beef sauté",
    steps: [
      "Sauté the meat in a wide pan over high heat until its juices come out and cook off.",
      "Cover and cook in its own juices over low heat for 25 minutes.",
      "Add the onion and peppers and cook for 5 minutes.",
      "Add the tomatoes and cook until their liquid has gone; season.",
    ],
  },
  "kiymali-patates-yemegi": {
    name: "Kıymalı patates yemeği (potato and mince stew)",
    shortName: "Potatoes with mince",
    steps: [
      "Fry the onion in a little oil, add the mince and cook until its liquid has gone.",
      "Add the tomato paste and chopped peppers.",
      "Add the diced potatoes and hot water to just cover.",
      "Cook for 25 minutes until the potatoes are soft, then season.",
    ],
  },
  "etli-bamya": {
    name: "Etli bamya (okra and beef stew)",
    shortName: "Okra stew",
    steps: [
      "Trim the okra caps into cones and leave them in lemony water.",
      "Brown the meat, add the onion and cook until translucent.",
      "Add the tomato paste and grated tomato and cook the meat with a cup of hot water for 30 minutes.",
      "Add the okra and drizzle with lemon juice.",
      "Cook for 15 minutes without stirring so the okra keeps its shape.",
    ],
  },
  "zeytinyagli-enginar": {
    name: "Zeytinyağlı enginar (artichokes in olive oil)",
    shortName: "Artichokes",
    steps: [
      "Clean the artichokes and keep them in lemony water so they don’t darken.",
      "Soften the onion in olive oil and add the diced carrot, potato and peas.",
      "Arrange the artichokes in the pot and fill their centres with the vegetables.",
      "Add the sugar, salt, lemon juice and a cup of hot water.",
      "Cook over low heat for 30 minutes; serve cold with dill.",
    ],
  },
  "hamsi-tava": {
    name: "Hamsi tava (fried anchovies)",
    shortName: "Fried anchovies",
    steps: [
      "Remove the heads and backbones of the anchovies, rinse them and let them drain.",
      "Salt them and coat in cornmeal.",
      "Fry in hot oil for a few minutes until both sides are golden.",
      "Drain on paper towels and serve with onion, rocket and lemon.",
    ],
  },
  "firinda-levrek": {
    name: "Fırında levrek (baked sea bass)",
    shortName: "Baked sea bass",
    steps: [
      "Score the cleaned fish a few times and salt them.",
      "Spread onion and tomato rings in a baking dish and lay the fish on top.",
      "Mix the olive oil, lemon juice and crushed garlic and drizzle it over.",
      "Bake at 200°C for 20–25 minutes and serve with parsley.",
    ],
  },
  "izgara-kofte": {
    name: "Izgara köfte (grilled meatballs)",
    shortName: "Grilled köfte",
    notes: { "Sivri biber": "for charring", Domates: "for charring" },
    prep: ["Take the mince out of the freezer", "Mix the meatball mixture and let it rest"],
    steps: [
      "Knead the mince with grated onion, bread crumb, egg and spices.",
      "Rest the mixture in the fridge for at least 30 minutes.",
      "Take walnut-sized pieces and shape flat patties.",
      "Cook in a cast-iron pan or on a grill for 4–5 minutes on each side.",
      "Char the peppers and tomatoes in the same pan and serve alongside.",
    ],
  },
  "tavuk-sis": {
    name: "Tavuk şiş (chicken skewers)",
    shortName: "Chicken skewers",
    prep: ["Move the chicken breast from the freezer to the fridge", "Put the chicken in the yoghurt marinade"],
    steps: [
      "Cut the chicken into bite-sized pieces.",
      "Marinate it with yoghurt, tomato paste, olive oil, crushed garlic and spices.",
      "Thread the chicken, peppers and onion onto skewers.",
      "Roast on a tray at 220°C for 20–25 minutes, turning halfway.",
    ],
  },
  "kabak-yemegi": {
    name: "Kabak yemeği (courgettes with mince)",
    shortName: "Courgette stew",
    notes: { Yoğurt: "to serve" },
    steps: [
      "Fry the onion, add the mince and cook until its liquid has gone.",
      "Add the grated tomato and the rice.",
      "Add the courgettes, cut into half-moons, and half a cup of hot water.",
      "Cook over low heat for 20 minutes; serve with dill and yoghurt.",
    ],
  },
  "mantar-sote": {
    name: "Mantar sote (sautéed mushrooms)",
    shortName: "Mushroom sauté",
    steps: [
      "Quarter the mushrooms; chop the onion and pepper.",
      "Soften the onion in butter, then add the garlic and pepper.",
      "Sauté the mushrooms over high heat until their liquid comes out and cooks off.",
      "Season with thyme, salt and pepper and serve hot.",
    ],
  },
  "tavuklu-pilav": {
    name: "Tavuklu pilav (chicken and rice)",
    shortName: "Chicken pilaf",
    prep: ["Soak the rice in warm salted water"],
    steps: [
      "Boil the chicken in 5 cups of water; strain and keep the stock, shred the meat.",
      "Fry the drained rice in butter until translucent.",
      "Add the chickpeas, salt and 3 cups of hot chicken stock.",
      "Cook over low heat until the liquid is absorbed, then let it steam for 10 minutes.",
      "Top with the shredded chicken and serve with black pepper.",
    ],
  },
  "kori-soslu-tavuk": {
    name: "Köri soslu tavuk (chicken in curry sauce)",
    shortName: "Curry chicken",
    steps: [
      "Cut the chicken into strips and sauté over high heat until its juices are gone.",
      "Add the onion, pepper and mushrooms and cook for 5 minutes.",
      "Add the curry powder and stir until fragrant.",
      "Add the cream, thicken over low heat for 5 minutes and season with salt.",
      "Serve with rice pilaf.",
    ],
  },
  "orman-kebabi": {
    name: "Orman kebabı (beef and vegetable stew)",
    shortName: "Orman kebabı",
    steps: [
      "Brown the meat in a pot in its own juices, then add the onion.",
      "Stir in the tomato paste and cook with hot water and a bay leaf for 45 minutes.",
      "Add the diced carrot and potato and cook for 15 minutes.",
      "Add the peas, cook for 10 more minutes and season.",
    ],
  },
  "patlican-kebabi": {
    name: "Patlıcan kebabı (aubergine and meatball bake)",
    shortName: "Aubergine kebab",
    prep: ["Take the mince out of the freezer"],
    steps: [
      "Knead the mince with grated onion, cumin and salt and shape small meatballs.",
      "Cut the aubergines into thick rounds.",
      "Arrange aubergine and meatballs in turns in a baking dish, with tomato slices in between.",
      "Lay the peppers on top and pour over the tomato-paste water.",
      "Bake covered with foil at 200°C for 30 minutes, then uncovered for 15 more.",
    ],
  },
  kapuska: {
    name: "Kapuska (cabbage and mince stew)",
    shortName: "Kapuska",
    steps: [
      "Shred the cabbage finely.",
      "Fry the onion, add the mince and cook until its liquid has gone.",
      "Add the pastes, then the cabbage, stirring until it wilts.",
      "Add the rice and a cup of hot water.",
      "Cook over low heat for 25 minutes and serve with chilli flakes.",
    ],
  },
  "sebzeli-tavuk-guvec": {
    name: "Sebzeli tavuk güveç (chicken and vegetable casserole)",
    shortName: "Chicken casserole",
    prep: ["Move the chicken thighs from the freezer to the fridge"],
    steps: [
      "Cut the chicken and vegetables into large chunks.",
      "Loosen the tomato paste with a cup of hot water and the spices.",
      "Toss everything together in a casserole dish and pour over the sauce.",
      "Cover with a lid or foil and bake at 200°C for 40 minutes.",
      "Uncover and bake for 10 more minutes to brown.",
    ],
  },
};
