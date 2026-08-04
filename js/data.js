// MindVault Core Data Store
const MindVaultData = {
  user: {
    name: "Aria Chen",
    email: "aria@mindvault.ai",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80",
    healthScore: 0,
    quote: "The quality of your life is the quality of your relationships. — Tony Robbins"
  },
  
  friends: [],
  diaries: [],
  dailyJournals: [],
  todaysTopics: [],
  todaysThoughts: [],
  reminders: [],
  knowledgeGraph: {
    nodes: [
      { id: 1, label: "Me", type: "user" }
    ],
    edges: []
  }
};
