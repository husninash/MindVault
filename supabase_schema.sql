-- MindVault Supabase Database Schema & Seed Data

-- 1. FRIENDS TABLE
CREATE TABLE IF NOT EXISTS friends (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  relation TEXT NOT NULL,
  avatar TEXT,
  tier TEXT DEFAULT 'Close Circle',
  birthday DATE,
  score INT DEFAULT 80,
  bio TEXT,
  favorites JSONB DEFAULT '{}'::jsonb,
  likes JSONB DEFAULT '[]'::jsonb,
  dislikes JSONB DEFAULT '[]'::jsonb,
  safe_topics JSONB DEFAULT '[]'::jsonb,
  avoid_topics JSONB DEFAULT '[]'::jsonb,
  current_life TEXT,
  ai_summary TEXT,
  gift_ideas JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. DIARIES TABLE
CREATE TABLE IF NOT EXISTS diaries (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  friend_id BIGINT REFERENCES friends(id) ON DELETE CASCADE,
  friend_name TEXT NOT NULL,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  location TEXT,
  mood TEXT,
  content TEXT NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. REMINDERS TABLE
CREATE TABLE IF NOT EXISTS reminders (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  friend_id BIGINT REFERENCES friends(id) ON DELETE SET NULL,
  type TEXT DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TODAYS_TOPICS TABLE
CREATE TABLE IF NOT EXISTS todays_topics (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  text TEXT NOT NULL,
  friend_id BIGINT REFERENCES friends(id) ON DELETE CASCADE,
  priority TEXT DEFAULT 'Medium',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. KNOWLEDGE GRAPH NODES TABLE
CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id BIGINT PRIMARY KEY,
  label TEXT NOT NULL,
  type TEXT NOT NULL
);

-- 6. KNOWLEDGE GRAPH EDGES TABLE
CREATE TABLE IF NOT EXISTS knowledge_edges (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  from_node BIGINT REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  to_node BIGINT REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  label TEXT NOT NULL
);

-- Enable Row Level Security (RLS) & Full CRUD Policies
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE todays_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_edges ENABLE ROW LEVEL SECURITY;

-- Friends CRUD Policies
CREATE POLICY "Allow public read access on friends" ON friends FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on friends" ON friends FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on friends" ON friends FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete access on friends" ON friends FOR DELETE USING (true);

-- Diaries CRUD Policies
CREATE POLICY "Allow public read access on diaries" ON diaries FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on diaries" ON diaries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on diaries" ON diaries FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete access on diaries" ON diaries FOR DELETE USING (true);

-- Reminders CRUD Policies
CREATE POLICY "Allow public read access on reminders" ON reminders FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on reminders" ON reminders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on reminders" ON reminders FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete access on reminders" ON reminders FOR DELETE USING (true);

-- Topics CRUD Policies
CREATE POLICY "Allow public read access on todays_topics" ON todays_topics FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on todays_topics" ON todays_topics FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on todays_topics" ON todays_topics FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete access on todays_topics" ON todays_topics FOR DELETE USING (true);

-- Knowledge Graph CRUD Policies
CREATE POLICY "Allow public read access on knowledge_nodes" ON knowledge_nodes FOR SELECT USING (true);
CREATE POLICY "Allow public all access on knowledge_nodes" ON knowledge_nodes FOR ALL USING (true);
CREATE POLICY "Allow public read access on knowledge_edges" ON knowledge_edges FOR SELECT USING (true);
CREATE POLICY "Allow public all access on knowledge_edges" ON knowledge_edges FOR ALL USING (true);


-- SEED DATA INSERTION
INSERT INTO friends (id, name, relation, avatar, tier, birthday, score, bio, favorites, likes, dislikes, safe_topics, avoid_topics, current_life, ai_summary, gift_ideas)
OVERRIDING SYSTEM VALUE
VALUES
(
  1,
  'Sophia Martinez',
  'Close Friend & Tech Co-founder',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
  'Inner Circle',
  '1997-09-14',
  94,
  'Coffee enthusiast, UI designer, loves indie pop & Tokyo travel.',
  '{"drink": "Iced Oat Latte (Matcha fallback)", "food": "Truffle Ramen & Avocado Toast", "color": "Sage Green & Lavender", "hobby": "Film photography & Ceramics", "book": "Atomic Habits by James Clear"}'::jsonb,
  '["Design Systems", "Figma", "Japan Trips", "Cat Cafes", "Minimalist Art"]'::jsonb,
  '["Late arrivals without text", "Cilantro", "Crowded loud bars"]'::jsonb,
  '["Her new photography studio", "Upcoming trip to Kyoto", "Favorite matcha spots in town"]'::jsonb,
  '["Her previous startup partnership conflict", "Moving back to Chicago"]'::jsonb,
  'Recently adopted a British Shorthair kitten named Mochi. Pitching her new design agency next Tuesday.',
  'Sophia values promptness and thoughtful aesthetic gestures. She prefers quiet cafes over noisy pubs. Mention Mochi the kitten and ask about her Kyoto itinerary for instant rapport.',
  '[{"item": "Fujifilm Instax Mini Evo", "price": "$199", "tag": "Tech & Photo"}, {"item": "Handmade Ceramic Matcha Bowl", "price": "$45", "tag": "Craft"}, {"item": "Blue Bottle Coffee Beans Subscription", "price": "$30", "tag": "Gourmet"}]'::jsonb
),
(
  2,
  'Liam Vance',
  'College Roommate & Software Architect',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
  'Inner Circle',
  '1996-11-22',
  91,
  'Avid runner, AI researcher, mechanical keyboard enthusiast.',
  '{"drink": "Cold Brew with Oat Milk", "food": "Smash Burgers & Wood-fired Pizza", "color": "Navy Blue & Slate", "hobby": "Marathon training & Keycap modding", "book": "Designing Data-Intensive Applications"}'::jsonb,
  '["Rust Language", "Trail Running", "Espresso Machines", "Sci-Fi Movies"]'::jsonb,
  '["Unnecessary meetings", "Overly sweet desserts"]'::jsonb,
  '["Training for Berlin Marathon", "Building local LLM agents", "Keyboard switches"]'::jsonb,
  '["His ex-girlfriend Clara", "Cryptocurrency trading loss"]'::jsonb,
  'Running 45km/week. Upgrading his home coffee station with a Rocket E61 espresso machine.',
  'Liam is deep tech focused and loves sharing technical updates. He appreciates practical coffee gear and fitness milestone encouragement.',
  '[{"item": "Garmin HRM-Pro Chest Strap", "price": "$129", "tag": "Fitness"}, {"item": "Custom PBT Artisan Keycap Set", "price": "$65", "tag": "Tech"}, {"item": "Specialty Espresso Bean Sampler", "price": "$35", "tag": "Coffee"}]'::jsonb
),
(
  3,
  'Maya Lin',
  'Creative Director & Travel Buddy',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80',
  'Close Circle',
  '1998-04-05',
  85,
  'Brand strategist, foodie, pottery artist.',
  '{"drink": "Earl Grey Tea with Honey", "food": "Authentic Thai & Dim Sum", "color": "Terracotta & Warm Ochre", "hobby": "Pottery & Vintage Thrifting", "book": "The Artist''s Way"}'::jsonb,
  '["Architectural Digest", "Vinyl Records", "Natural Wine", "Scandinavia"]'::jsonb,
  '["Corporate jargon", "Fast fashion"]'::jsonb,
  '["Her upcoming pottery exhibition", "Favorite vintage markets", "Copenhagen travel tips"]'::jsonb,
  '["Renovation delay budget overruns"]'::jsonb,
  'Preparing a solo ceramics showcase called ''Earth & Forms'' at Soho Art Gallery.',
  'Maya loves artistic discussions and sensory experiences. Sending her an encouraging note before her gallery show will mean a lot.',
  '[{"item": "Kinto Unimug Glass Tea Pot", "price": "$28", "tag": "Lifestyle"}, {"item": "Le Labo Santal 26 Candle", "price": "$82", "tag": "Home"}]'::jsonb
),
(
  4,
  'Ethan Wright',
  'High School Best Friend',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
  'Longtime Friend',
  '1996-08-18',
  79,
  'Product Manager, bouldering fanatic, dog dad to Oliver.',
  '{"drink": "Craft IPA & Kombucha", "food": "Tacos & Korean BBQ", "color": "Forest Green", "hobby": "Rock Climbing & Camping", "book": "Shoe Dog"}'::jsonb,
  '["Outdoor Bouldering", "Golden Retrievers", "Board Games"]'::jsonb,
  '["Stuffy formal events", "Traffic jams"]'::jsonb,
  '["Oliver''s agility training", "Climbing trip to Yosemite", "Catan night"]'::jsonb,
  '["Company restructuring rumors at his job"]'::jsonb,
  'Just adopted Oliver the Golden Retriever. Planning a weekend camping trip.',
  'Ethan is casual and outdoor-loving. Connect with him over dog stories or climbing goals.',
  '[{"item": "Patagonia Black Hole Duffel", "price": "$149", "tag": "Outdoors"}, {"item": "Hydro Flask Insulated Dog Bowl", "price": "$40", "tag": "Pets"}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO diaries (id, friend_id, friend_name, date, title, location, mood, content, tags)
OVERRIDING SYSTEM VALUE
VALUES
(101, 1, 'Sophia Martinez', '2026-08-01', 'Matcha Catch-up & Studio Discussion', 'Kissa Matcha Lounge, Downtown', '😊 Energetic & Inspired', 'Met Sophia for afternoon matcha. She showed me mockups for her brand identity. She mentioned she''s taking Mochi to the vet for routine checkup on Friday. We discussed traveling together to Kyoto in October.', '["Matcha", "Kyoto Trip", "Mochi The Cat", "Branding"]'::jsonb),
(102, 2, 'Liam Vance', '2026-07-28', 'Marathon Milestone & Coffee Talk', 'Blue Bottle Coffee', '⚡ Motivated', 'Liam ran 30km last Sunday! He''s feeling confident for Berlin. We debugged a local LLM memory leak issue together. Promised to send him the specialty beans I brought from Bali.', '["Running", "Marathon", "AI", "Espresso"]'::jsonb),
(103, 3, 'Maya Lin', '2026-07-20', 'Pottery Studio Visit', 'Soho Clay Collective', '🎨 Creative & Warm', 'Visited Maya''s pottery studio. Helped her glaze 12 ceramic vases for her ''Earth & Forms'' exhibition. She was really touched that I came by.', '["Art", "Pottery", "Exhibition"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO reminders (id, date, title, friend_id, type)
OVERRIDING SYSTEM VALUE
VALUES
(201, '2026-08-18', 'Ethan''s 30th Birthday', 4, 'Birthday'),
(202, '2026-08-10', 'Send Maya Exhibition Good Luck Flowers', 3, 'Support'),
(203, '2026-09-14', 'Sophia''s Birthday & Kyoto Trip Planning', 1, 'Birthday')
ON CONFLICT (id) DO NOTHING;

INSERT INTO todays_topics (id, text, friend_id, priority)
OVERRIDING SYSTEM VALUE
VALUES
(1, 'Ask Sophia about Mochi''s Friday vet checkup', 1, 'High'),
(2, 'Congratulate Liam on his 45km weekly run goal', 2, 'Medium'),
(3, 'Send Maya a good luck message for her Soho Art Showcase prep', 3, 'High')
ON CONFLICT (id) DO NOTHING;

INSERT INTO knowledge_nodes (id, label, type) VALUES
(1, 'Aria Chen (Me)', 'user'),
(2, 'Sophia Martinez', 'friend'),
(3, 'Liam Vance', 'friend'),
(4, 'Maya Lin', 'friend'),
(5, 'Ethan Wright', 'friend'),
(6, 'Kyoto Japan', 'interest'),
(7, 'Espresso & Matcha', 'interest'),
(8, 'AI & Tech', 'interest'),
(9, 'Pottery & Art', 'interest'),
(10, 'Running & Outdoors', 'interest')
ON CONFLICT (id) DO NOTHING;

INSERT INTO knowledge_edges (id, from_node, to_node, label)
OVERRIDING SYSTEM VALUE
VALUES
(1, 1, 2, 'Co-founder'),
(2, 1, 3, 'Roommate'),
(3, 1, 4, 'Travel Buddy'),
(4, 1, 5, 'High School'),
(5, 2, 6, 'Loves'),
(6, 2, 7, 'Loves'),
(7, 3, 7, 'Loves'),
(8, 3, 8, 'Researches'),
(9, 4, 9, 'Creates'),
(10, 5, 10, 'Practices'),
(11, 2, 4, 'Design Collab')
ON CONFLICT (id) DO NOTHING;
