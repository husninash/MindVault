// MindVault Core Data Store
const MindVaultData = {
  user: {
    name: "Aria Chen",
    email: "aria@mindvault.ai",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80",
    healthScore: 88,
    quote: "The quality of your life is the quality of your relationships. — Tony Robbins"
  },
  
  friends: [
    {
      id: 1,
      name: "Sophia Martinez",
      relation: "Close Friend & Tech Co-founder",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80",
      tier: "Inner Circle",
      birthday: "1997-09-14",
      score: 94,
      bio: "Coffee enthusiast, UI designer, loves indie pop & Tokyo travel.",
      favorites: {
        drink: "Iced Oat Latte (Matcha fallback)",
        food: "Truffle Ramen & Avocado Toast",
        color: "Sage Green & Lavender",
        hobby: "Film photography & Ceramics",
        book: "Atomic Habits by James Clear"
      },
      likes: ["Design Systems", "Figma", "Japan Trips", "Cat Cafes", "Minimalist Art"],
      dislikes: ["Late arrivals without text", "Cilantro", "Crowded loud bars"],
      safeTopics: ["Her new photography studio", "Upcoming trip to Kyoto", "Favorite matcha spots in town"],
      avoidTopics: ["Her previous startup partnership conflict", "Moving back to Chicago"],
      currentLife: "Recently adopted a British Shorthair kitten named Mochi. Pitching her new design agency next Tuesday.",
      aiSummary: "Sophia values promptness and thoughtful aesthetic gestures. She prefers quiet cafes over noisy pubs. Mention Mochi the kitten and ask about her Kyoto itinerary for instant rapport.",
      giftIdeas: [
        { item: "Fujifilm Instax Mini Evo", price: "$199", tag: "Tech & Photo" },
        { item: "Handmade Ceramic Matcha Bowl", price: "$45", tag: "Craft" },
        { item: "Blue Bottle Coffee Beans Subscription", price: "$30", tag: "Gourmet" }
      ]
    },
    {
      id: 2,
      name: "Liam Vance",
      relation: "College Roommate & Software Architect",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80",
      tier: "Inner Circle",
      birthday: "1996-11-22",
      score: 91,
      bio: "Avid runner, AI researcher, mechanical keyboard enthusiast.",
      favorites: {
        drink: "Cold Brew with Oat Milk",
        food: "Smash Burgers & Wood-fired Pizza",
        color: "Navy Blue & Slate",
        hobby: "Marathon training & Keycap modding",
        book: "Designing Data-Intensive Applications"
      },
      likes: ["Rust Language", "Trail Running", "Espresso Machines", "Sci-Fi Movies"],
      dislikes: ["Unnecessary meetings", "Overly sweet desserts"],
      safeTopics: ["Training for Berlin Marathon", "Building local LLM agents", "Keyboard switches"],
      avoidTopics: ["His ex-girlfriend Clara", "Cryptocurrency trading loss"],
      currentLife: "Running 45km/week. Upgrading his home coffee station with a Rocket E61 espresso machine.",
      aiSummary: "Liam is deep tech focused and loves sharing technical updates. He appreciates practical coffee gear and fitness milestone encouragement.",
      giftIdeas: [
        { item: "Garmin HRM-Pro Chest Strap", price: "$129", tag: "Fitness" },
        { item: "Custom PBT Artisan Keycap Set", price: "$65", tag: "Tech" },
        { item: "Specialty Espresso Bean Sampler", price: "$35", tag: "Coffee" }
      ]
    },
    {
      id: 3,
      name: "Maya Lin",
      relation: "Creative Director & Travel Buddy",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80",
      tier: "Close Circle",
      birthday: "1998-04-05",
      score: 85,
      bio: "Brand strategist, foodie, pottery artist.",
      favorites: {
        drink: "Earl Grey Tea with Honey",
        food: "Authentic Thai & Dim Sum",
        color: "Terracotta & Warm Ochre",
        hobby: "Pottery & Vintage Thrifting",
        book: "The Artist's Way"
      },
      likes: ["Architectural Digest", "Vinyl Records", "Natural Wine", "Scandinavia"],
      dislikes: ["Corporate jargon", "Fast fashion"],
      safeTopics: ["Her upcoming pottery exhibition", "Favorite vintage markets", "Copenhagen travel tips"],
      avoidTopics: ["Renovation delay budget overruns"],
      currentLife: "Preparing a solo ceramics showcase called 'Earth & Forms' at Soho Art Gallery.",
      aiSummary: "Maya loves artistic discussions and sensory experiences. Sending her an encouraging note before her gallery show will mean a lot.",
      giftIdeas: [
        { item: "Kinto Unimug Glass Tea Pot", price: "$28", tag: "Lifestyle" },
        { item: "Le Labo Santal 26 Candle", price: "$82", tag: "Home" }
      ]
    },
    {
      id: 4,
      name: "Ethan Wright",
      relation: "High School Best Friend",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80",
      tier: "Longtime Friend",
      birthday: "1996-08-18",
      score: 79,
      bio: "Product Manager, bouldering fanatic, dog dad to Oliver.",
      favorites: {
        drink: "Craft IPA & Kombucha",
        food: "Tacos & Korean BBQ",
        color: "Forest Green",
        hobby: "Rock Climbing & Camping",
        book: "Shoe Dog"
      },
      likes: ["Outdoor Bouldering", "Golden Retrievers", "Board Games"],
      dislikes: ["Stuffy formal events", "Traffic jams"],
      safeTopics: ["Oliver's agility training", "Climbing trip to Yosemite", "Catan night"],
      avoidTopics: ["Company restructuring rumors at his job"],
      currentLife: "Just adopted Oliver the Golden Retriever. Planning a weekend camping trip.",
      aiSummary: "Ethan is casual and outdoor-loving. Connect with him over dog stories or climbing goals.",
      giftIdeas: [
        { item: "Patagonia Black Hole Duffel", price: "$149", tag: "Outdoors" },
        { item: "Hydro Flask Insulated Dog Bowl", price: "$40", tag: "Pets" }
      ]
    }
  ],

  diaries: [
    {
      id: 101,
      friendId: 1,
      friendName: "Sophia Martinez",
      date: "2026-08-01",
      title: "Matcha Catch-up & Studio Discussion",
      location: "Kissa Matcha Lounge, Downtown",
      mood: "😊 Energetic & Inspired",
      content: "Met Sophia for afternoon matcha. She showed me mockups for her brand identity. She mentioned she's taking Mochi to the vet for routine checkup on Friday. We discussed traveling together to Kyoto in October.",
      tags: ["Matcha", "Kyoto Trip", "Mochi The Cat", "Branding"]
    },
    {
      id: 102,
      friendId: 2,
      friendName: "Liam Vance",
      date: "2026-07-28",
      title: "Marathon Milestone & Coffee Talk",
      location: "Blue Bottle Coffee",
      mood: "⚡ Motivated",
      content: "Liam ran 30km last Sunday! He's feeling confident for Berlin. We debugged a local LLM memory leak issue together. Promised to send him the specialty beans I brought from Bali.",
      tags: ["Running", "Marathon", "AI", "Espresso"]
    },
    {
      id: 103,
      friendId: 3,
      friendName: "Maya Lin",
      date: "2026-07-20",
      title: "Pottery Studio Visit",
      location: "Soho Clay Collective",
      mood: "🎨 Creative & Warm",
      content: "Visited Maya's pottery studio. Helped her glaze 12 ceramic vases for her 'Earth & Forms' exhibition. She was really touched that I came by.",
      tags: ["Art", "Pottery", "Exhibition"]
    }
  ],

  todaysTopics: [
    { text: "Ask Sophia about Mochi's Friday vet checkup", friendId: 1, priority: "High" },
    { text: "Congratulate Liam on his 45km weekly run goal", friendId: 2, priority: "Medium" },
    { text: "Send Maya a good luck message for her Soho Art Showcase prep", friendId: 3, priority: "High" }
  ],

  todaysThoughts: [
    "Great relationships aren't built on grand gestures, but on remembering the small details that matter to people.",
    "Plan a monthly dinner group to keep college friends connected in 3D space."
  ],

  reminders: [
    { id: 201, date: "2026-08-18", title: "Ethan's 30th Birthday", friendId: 4, type: "Birthday" },
    { id: 202, date: "2026-08-10", title: "Send Maya Exhibition Good Luck Flowers", friendId: 3, type: "Support" },
    { id: 203, date: "2026-09-14", title: "Sophia's Birthday & Kyoto Trip Planning", friendId: 1, type: "Birthday" }
  ],

  knowledgeGraph: {
    nodes: [
      { id: 1, label: "Aria Chen (Me)", type: "user" },
      { id: 2, label: "Sophia Martinez", type: "friend" },
      { id: 3, label: "Liam Vance", type: "friend" },
      { id: 4, label: "Maya Lin", type: "friend" },
      { id: 5, label: "Ethan Wright", type: "friend" },
      { id: 6, label: "Kyoto Japan", type: "interest" },
      { id: 7, label: "Espresso & Matcha", type: "interest" },
      { id: 8, label: "AI & Tech", type: "interest" },
      { id: 9, label: "Pottery & Art", type: "interest" },
      { id: 10, label: "Running & Outdoors", type: "interest" }
    ],
    edges: [
      { from: 1, to: 2, label: "Co-founder" },
      { from: 1, to: 3, label: "Roommate" },
      { from: 1, to: 4, label: "Travel Buddy" },
      { from: 1, to: 5, label: "High School" },
      { from: 2, to: 6, label: "Loves" },
      { from: 2, to: 7, label: "Loves" },
      { from: 3, to: 7, label: "Loves" },
      { from: 3, to: 8, label: "Researches" },
      { from: 4, to: 9, label: "Creates" },
      { from: 5, to: 10, label: "Practices" },
      { from: 2, to: 4, label: "Design Collab" }
    ]
  }
};
