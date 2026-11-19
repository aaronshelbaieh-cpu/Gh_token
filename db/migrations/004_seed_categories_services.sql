-- Global Events Directory (GED) — Phase 1
-- Seed all GED service categories and services

BEGIN;

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

INSERT INTO categories (slug, name, sort_order) VALUES
    ('venues',              'Venues',                10),
    ('food-drink',          'Food & Drink',          20),
    ('music-entertainment', 'Music & Entertainment', 30),
    ('photo-video',         'Photo & Video',         40),
    ('styling-decor',       'Styling & Decor',       50),
    ('outfits',             'Outfits',               60),
    ('hair-beauty',         'Hair & Beauty',         70),
    ('hire-equipment',      'Hire & Equipment',      80),
    ('planning',            'Planning',              90),
    ('transport',           'Transport',            100);

-- ---------------------------------------------------------------------------
-- Services helper
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE _svc (
    category_slug TEXT NOT NULL,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    aliases TEXT[] NOT NULL DEFAULT '{}',
    sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO _svc (category_slug, slug, name, aliases, sort_order) VALUES
-- Venues
('venues', 'venues', 'Venues', ARRAY['Wedding Venues','Event Venues','Party Venues'], 10),
('venues', 'marquees', 'Marquees', ARRAY['Marquee Hire','Wedding Marquee'], 20),
('venues', 'shoot-locations', 'Shoot Locations', ARRAY['Film Locations','Photo Locations'], 30),
('venues', 'kids-party-venues', 'Kids Party Venues and Packages', ARRAY['Kids Party Venues','Children Party Packages'], 40),
('venues', 'dog-friendly-venues', 'Dog-Friendly Venues and Pet Cafés', ARRAY['Dog Friendly Venues','Pet Cafes'], 50),

-- Food & Drink
('food-drink', 'afternoon-tea', 'Afternoon Tea', ARRAY['Afternoon Tea Catering'], 10),
('food-drink', 'alcohol-free-mocktail-bars', 'Alcohol-Free and Mocktail Bars', ARRAY['Mocktail Bars','Alcohol Free Bars'], 20),
('food-drink', 'bbq-smokehouse', 'BBQ and Smokehouse', ARRAY['BBQ Catering','Smokehouse'], 30),
('food-drink', 'cakes', 'Cakes', ARRAY['Wedding Cakes','Celebration Cakes'], 40),
('food-drink', 'catering-beverages', 'Catering and Beverages', ARRAY['Wedding Caterers','Event Catering'], 50),
('food-drink', 'cocktail-bars', 'Cocktail Bars', ARRAY['Cocktail Bar Hire'], 60),
('food-drink', 'coffee-mobile-barista', 'Coffee and Mobile Barista', ARRAY['Mobile Barista','Coffee Van'], 70),
('food-drink', 'drinks-suppliers', 'Drinks Suppliers', ARRAY['Beverage Suppliers'], 80),
('food-drink', 'food-vans-street-food', 'Food Vans and Street Food', ARRAY['Food Trucks','Street Food'], 90),
('food-drink', 'grazing-tables-platters', 'Grazing Tables and Platters', ARRAY['Grazing Tables','Charcuterie'], 100),
('food-drink', 'hog-roasts', 'Hog Roasts', ARRAY['Hog Roast Catering'], 110),
('food-drink', 'ice-cream-carts', 'Ice Cream Carts', ARRAY['Ice Cream Van','Gelato Cart'], 120),
('food-drink', 'mixologists', 'Mixologists', ARRAY['Mixologist Hire'], 130),
('food-drink', 'mobile-bars', 'Mobile Bars', ARRAY['Mobile Bar Hire'], 140),
('food-drink', 'pet-cakes-treats', 'Pet Cakes and Treats', ARRAY['Dog Cakes','Pet Treats'], 150),
('food-drink', 'pick-and-mix-carts', 'Pick and Mix Carts', ARRAY['Pick and Mix','Sweet Carts'], 160),
('food-drink', 'popcorn-sweet-treats', 'Popcorn and Sweet Treats', ARRAY['Popcorn Cart','Sweet Treats'], 170),
('food-drink', 'private-chef', 'Private Chef', ARRAY['Private Chefs','Personal Chef'], 180),
('food-drink', 'prosecco-vans', 'Prosecco Vans', ARRAY['Prosecco Van Hire'], 190),
('food-drink', 'self-service-bars', 'Self-Service Bars', ARRAY['Self Serve Bars'], 200),
('food-drink', 'stone-baked-pizza', 'Stone-Baked Pizza', ARRAY['Pizza Van','Mobile Pizza'], 210),
('food-drink', 'whisky-gin-spirits-tasting', 'Whisky Gin and Spirits Tasting', ARRAY['Whisky Tasting','Gin Tasting'], 220),
('food-drink', 'wine-tasting-sommeliers', 'Wine Tasting and Sommeliers', ARRAY['Wine Tasting','Sommelier'], 230),
('food-drink', 'world-cultural-catering', 'World and Cultural Catering', ARRAY['Cultural Catering','World Cuisine Catering'], 240),

-- Music & Entertainment
('music-entertainment', 'acoustic-acts', 'Acoustic Acts', ARRAY['Acoustic Duo','Acoustic Singer'], 10),
('music-entertainment', 'bouncy-castles-inflatables', 'Bouncy Castles and Inflatables', ARRAY['Bouncy Castle Hire','Inflatables'], 20),
('music-entertainment', 'cabaret-acts', 'Cabaret Acts', ARRAY['Cabaret Entertainment'], 30),
('music-entertainment', 'caricaturists', 'Caricaturists', ARRAY['Wedding Caricaturist'], 40),
('music-entertainment', 'choirs', 'Choirs', ARRAY['Wedding Choir','Gospel Choir'], 50),
('music-entertainment', 'choreographers', 'Choreographers', ARRAY['Wedding Choreographer'], 60),
('music-entertainment', 'classical-musicians', 'Classical Musicians', ARRAY['String Quartet','Classical Duo'], 70),
('music-entertainment', 'dance-lessons', 'Dance Lessons', ARRAY['First Dance Lessons'], 80),
('music-entertainment', 'dancers-performance-troupes', 'Dancers and Performance Troupes', ARRAY['Dance Troupe','Performance Dancers'], 90),
('music-entertainment', 'dhol-players', 'Dhol Players', ARRAY['Dhol Drummers'], 100),
('music-entertainment', 'djs-bands-musicians', 'DJs Bands and Musicians', ARRAY['Wedding DJ','Wedding Band','DJ Hire'], 110),
('music-entertainment', 'drag-artists', 'Drag Artists', ARRAY['Drag Entertainment'], 120),
('music-entertainment', 'entertainment', 'Entertainment', ARRAY['Event Entertainment','Party Entertainment'], 130),
('music-entertainment', 'face-painters', 'Face Painters', ARRAY['Face Painting'], 140),
('music-entertainment', 'fireworks-displays', 'Fireworks Displays', ARRAY['Wedding Fireworks','Firework Display'], 150),
('music-entertainment', 'folk-celtic-musicians', 'Folk and Celtic Musicians', ARRAY['Celtic Band','Folk Musicians'], 160),
('music-entertainment', 'jazz-bands', 'Jazz Bands', ARRAY['Jazz Trio','Wedding Jazz'], 170),
('music-entertainment', 'lion-dragon-dancers', 'Lion and Dragon Dancers', ARRAY['Lion Dance','Dragon Dance'], 180),
('music-entertainment', 'live-music', 'Live Music', ARRAY['Live Band','Live Musicians'], 190),
('music-entertainment', 'magicians', 'Magicians', ARRAY['Wedding Magician','Close Up Magician'], 200),
('music-entertainment', 'mascots', 'Mascots', ARRAY['Mascot Hire'], 210),
('music-entertainment', 'mobile-farms', 'Mobile Farms', ARRAY['Petting Farm','Mobile Farm Hire'], 220),
('music-entertainment', 'opera-singers', 'Opera Singers', ARRAY['Opera Singer Hire'], 230),
('music-entertainment', 'party-characters', 'Party Characters', ARRAY['Character Entertainers'], 240),
('music-entertainment', 'rnb-artists', 'R&B Artists', ARRAY['RnB Singer','R and B Artists'], 250),
('music-entertainment', 'rock-bands', 'Rock Bands', ARRAY['Rock Band Hire'], 260),
('music-entertainment', 'singers', 'Singers', ARRAY['Wedding Singer','Solo Singer'], 270),
('music-entertainment', 'steel-bands', 'Steel Bands', ARRAY['Steel Pan Band'], 280),
('music-entertainment', 'talent-agencies', 'Talent Agencies', ARRAY['Entertainment Agency'], 290),
('music-entertainment', 'tattoo-artists', 'Tattoo Artists', ARRAY['Temporary Tattoo Artists','Glitter Tattoos'], 300),

-- Photo & Video
('photo-video', 'photography', 'Photography', ARRAY['Wedding Photography','Event Photographer'], 10),
('photo-video', 'videography', 'Videography', ARRAY['Wedding Videography','Event Videographer'], 20),
('photo-video', 'photo-booth', 'Photo Booth', ARRAY['Photo Booth Hire','Wedding Photo Booth'], 30),
('photo-video', 'video-booth', 'Video Booth', ARRAY['Video Booth Hire'], 40),
('photo-video', 'content-creator', 'Content Creator', ARRAY['Event Content Creator','Social Content Creator'], 50),

-- Styling & Decor
('styling-decor', 'balloon-decor', 'Balloon Decor', ARRAY['Balloon Arch','Balloon Decorations'], 10),
('styling-decor', 'custom-merchandise', 'Custom Merchandise', ARRAY['Personalised Merchandise'], 20),
('styling-decor', 'decorations', 'Decorations', ARRAY['Event Decorations','Wedding Decor'], 30),
('styling-decor', 'floristry', 'Floristry', ARRAY['Florist','Wedding Florist'], 40),
('styling-decor', 'mandap-stage-decor', 'Mandap and Stage Décor', ARRAY['Mandap','Stage Decor'], 50),
('styling-decor', 'pet-party-supplies', 'Pet Party Supplies', ARRAY['Dog Party Supplies'], 60),
('styling-decor', 'stationery', 'Stationery', ARRAY['Wedding Stationery','Invitations'], 70),
('styling-decor', 'wedding-stylist', 'Wedding Stylist', ARRAY['Event Stylist'], 80),

-- Outfits
('outfits', 'bridal', 'Bridal', ARRAY['Bridal Wear','Wedding Dresses'], 10),
('outfits', 'bridesmaid', 'Bridesmaid', ARRAY['Bridesmaid Dresses'], 20),
('outfits', 'cap-gown-hire', 'Cap and Gown Hire', ARRAY['Graduation Gown Hire'], 30),
('outfits', 'costume-designers', 'Costume Designers', ARRAY['Costume Design'], 40),
('outfits', 'costume-hire', 'Costume Hire', ARRAY['Fancy Dress Hire'], 50),
('outfits', 'dress-hire', 'Dress Hire', ARRAY['Evening Dress Hire'], 60),
('outfits', 'gele-stylists', 'Gele Stylists', ARRAY['Gele Tying'], 70),
('outfits', 'groomswear', 'Groomswear', ARRAY['Groomsmen Wear'], 80),
('outfits', 'jeweller', 'Jeweller', ARRAY['Wedding Jewellery','Jeweler'], 90),
('outfits', 'mother-of-the-bride', 'Mother of the Bride', ARRAY['Mother of the Bride Outfits'], 100),
('outfits', 'suit-hire', 'Suit Hire', ARRAY['Wedding Suit Hire'], 110),

-- Hair & Beauty
('hair-beauty', 'aesthetics', 'Aesthetics', ARRAY['Aesthetic Treatments'], 10),
('hair-beauty', 'bespoke-perfumery', 'Bespoke Perfumery', ARRAY['Custom Perfume'], 20),
('hair-beauty', 'fitness', 'Fitness', ARRAY['Wedding Fitness','Personal Trainer'], 30),
('hair-beauty', 'hair-stylists', 'Hair Stylists', ARRAY['Wedding Hair','Bridal Hair'], 40),
('hair-beauty', 'henna-artists', 'Henna Artists', ARRAY['Mehndi Artists'], 50),
('hair-beauty', 'makeup-artists', 'Makeup Artists', ARRAY['Bridal Makeup','MUA'], 60),
('hair-beauty', 'nail-technicians', 'Nail Technicians', ARRAY['Nail Tech','Manicure'], 70),
('hair-beauty', 'pamper-spa', 'Pamper and Spa', ARRAY['Spa Treatments','Pamper Parties'], 80),
('hair-beauty', 'spray-tanning', 'Spray Tanning', ARRAY['Mobile Spray Tan'], 90),
('hair-beauty', 'teeth-whitening', 'Teeth Whitening', ARRAY['Mobile Teeth Whitening'], 100),
('hair-beauty', 'theatrical-makeup-wigs', 'Theatrical Makeup and Wigs', ARRAY['Theatrical Makeup','Wig Hire'], 110),

-- Hire & Equipment
('hire-equipment', 'backdrops', 'Backdrops', ARRAY['Backdrop Hire','Photo Backdrop'], 10),
('hire-equipment', 'dance-floors', 'Dance Floors', ARRAY['Dance Floor Hire'], 20),
('hire-equipment', 'event-cleaning', 'Event Cleaning', ARRAY['Post Event Cleaning'], 30),
('hire-equipment', 'event-creche', 'Event Crèche', ARRAY['Event Creche','Wedding Crèche'], 40),
('hire-equipment', 'event-flooring', 'Event Flooring', ARRAY['Temporary Flooring'], 50),
('hire-equipment', 'event-security', 'Event Security', ARRAY['Security Staff'], 60),
('hire-equipment', 'event-staff', 'Event Staff', ARRAY['Wait Staff','Event Stewarding'], 70),
('hire-equipment', 'fairground-rides', 'Fairground Rides', ARRAY['Fairground Hire','Carousel Hire'], 80),
('hire-equipment', 'film-equipment', 'Film Equipment', ARRAY['Camera Hire','Film Kit Hire'], 90),
('hire-equipment', 'first-aid', 'First Aid', ARRAY['Event First Aid','Medic Cover'], 100),
('hire-equipment', 'furniture-hire', 'Furniture Hire', ARRAY['Event Furniture','Chair Hire'], 110),
('hire-equipment', 'generator-hire', 'Generator Hire', ARRAY['Event Generators'], 120),
('hire-equipment', 'heating-air-conditioning', 'Heating and Air Conditioning', ARRAY['Event Heating','AC Hire'], 130),
('hire-equipment', 'lighting-hire', 'Lighting Hire', ARRAY['Event Lighting','Uplighters'], 140),
('hire-equipment', 'parade-floats', 'Parade Floats', ARRAY['Float Hire'], 150),
('hire-equipment', 'parking-management', 'Parking Management', ARRAY['Event Parking'], 160),
('hire-equipment', 'pat-testing', 'PAT Testing', ARRAY['Portable Appliance Testing'], 170),
('hire-equipment', 'prop-hire', 'Prop Hire', ARRAY['Event Props'], 180),
('hire-equipment', 'set-design', 'Set Design', ARRAY['Event Set Design'], 190),
('hire-equipment', 'stage-sound-av', 'Stage Sound and AV', ARRAY['PA Hire','AV Hire','Stage Hire'], 200),
('hire-equipment', 'tableware-equipment', 'Tableware Equipment', ARRAY['Crockery Hire','Glassware Hire'], 210),
('hire-equipment', 'toilet-hire', 'Toilet Hire', ARRAY['Luxury Toilet Hire','Portaloo'], 220),

-- Planning
('planning', 'celebrant', 'Celebrant', ARRAY['Wedding Celebrant','Civil Celebrant'], 10),
('planning', 'event-planning-coordination', 'Event Planning and Coordination', ARRAY['Event Planner','Event Coordinator'], 20),
('planning', 'toastmasters', 'Toastmasters', ARRAY['Wedding Toastmaster'], 30),
('planning', 'travel-consultancy', 'Travel Consultancy', ARRAY['Destination Wedding Travel'], 40),
('planning', 'wedding-planner', 'Wedding Planner', ARRAY['Wedding Planning'], 50),

-- Transport
('transport', 'limousines', 'Limousines', ARRAY['Wedding Limousines','Limo Hire'], 10),
('transport', 'party-buses', 'Party Buses', ARRAY['Party Bus Hire'], 20),
('transport', 'transport', 'Transport', ARRAY['Wedding Cars','Event Transport','Wedding Car Hire'], 30);

INSERT INTO services (category_id, slug, name, search_aliases, sort_order)
SELECT c.id, s.slug, s.name, s.aliases, s.sort_order
FROM _svc s
JOIN categories c ON c.slug = s.category_slug;

DROP TABLE _svc;

COMMIT;
