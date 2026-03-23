/**
 * Rule-based Icebreaker Templates
 * Structured by category and tone.
 */
export const ICEBREAKER_TEMPLATES = {
  travel: {
    funny: [
      "I see you like traveling! If you had to survive a zombie apocalypse with only what's in your carry-on, how long are we lasting? 😂",
      "Are you more of a 'plan every minute' traveler or a 'figure it out at the airport' kind of person? ✈️",
      "Quick! You just won a free flight to anywhere in the world, but you have to leave in 2 hours. Where are we going? 🌍"
    ],
    flirty: [
      "I'm usually good at picking a destination, but you look like you have even better taste. Where's the next adventure? 😏",
      "I've got a spare passport stamp waiting. Think you could handle a travel partner who always wants the window seat? 🗺️",
      "You look like you've seen some amazing places. Which one made you never want to leave? ✨"
    ]
  },
  fitness: {
    funny: [
      "I see those gym pics! Do you prefer a workout that makes you feel like a beast or one that makes you want to crawl home? 💪",
      "Help! I need a new workout playlist. What's the one song that gets you through that last set? 🎧",
      "If we went to the gym together, would you judge me for spent half the time at the water fountain? 😂"
    ],
    flirty: [
      "Your dedication is impressive! What's the secret to staying that motivated? (And can I borrow some?) 😏",
      "I'm looking for a new gym partner who won't let me slack off. Think you're up for the challenge? 🔥",
      "Looking that good while working out is a literal talent. What's your favorite post-gym treat? ✨"
    ]
  },
  food: {
    funny: [
      "Critical question: Does pineapple belong on pizza? This will determine our entire future. 🍕",
      "If you could only eat one meal for the rest of your life, what would it be? (Choose wisely, {name}!) 😂",
      "I'm a self-proclaimed professional snacker. What's your go-to late-night comfort food? 🍦"
    ],
    flirty: [
      "You look like someone who knows all the best hidden food spots. Care to share one over a drink? 😏",
      "I'm a decent cook, but I bet you’re better. What's your absolute signature dish? 🍷",
      "They say the way to the heart is through the stomach. What's the best meal you've ever had? ✨"
    ]
  },
  pets: {
    funny: [
      "I saw the pet photo! Does your fur baby approve of strangers from dating apps, or do I need to pass a test? 🐶",
      "On a scale of 1 to 'buys them a tiny birthday hat', how obsessed are you with your pet? 😂",
      "If your pet could talk, what's the first thing they'd tell me about you that I should know? 🐾"
    ],
    flirty: [
      "You + that pet = too much cuteness for one profile. Who's the real boss of the house? 😏",
      "I might just be swiping for a chance to meet your dog, but you're a pretty great bonus. 🐶",
      "Is there room for one more on your next pet-friendly walk? ✨"
    ]
  },
  default: {
    funny: [
      "I'm writing a book on the worst opening lines, but I'd rather hear yours. What's the best one you've got? 😂",
      "If you were a character in a movie, would you be the hero, the villain, or the one who dies in the first 5 minutes? 🍿",
      "Quick! Give me a random fact that most people find completely useless. 😂"
    ],
    flirty: [
      "Your energy in these photos is amazing! What's one thing that always makes your day better? 😏",
      "I was going to wait for you to message me first, but I'm clearly not that patient. How's your week going? ✨",
      "You caught my eye immediately! What’s a passion of yours that you could talk about for hours? 🔥"
    ]
  }
};

/**
 * Keyword mapping for category detection
 */
export const CATEGORY_KEYWORDS = {
  travel: ['travel', 'trip', 'adventure', 'wanderlust', 'passport', 'explore', 'vacation', 'mountains', 'beach', 'flight'],
  fitness: ['gym', 'workout', 'fitness', 'run', 'yoga', 'lift', 'athlete', 'crossfit', 'hiking', 'sport', 'exercise'],
  food: ['food', 'cook', 'chef', 'pizza', 'sushi', 'coffee', 'wine', 'beer', 'dinner', 'brunch', 'restaurant', 'tacos'],
  pets: ['dog', 'cat', 'pet', 'puppy', 'kitten', 'animal', 'furry', 'golden retriever']
};
