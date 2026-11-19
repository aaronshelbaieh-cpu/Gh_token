-- Global Events Directory (GED) — Phase 1
-- UK location scaffold: country → nations → counties → major cities/towns
-- Full town coverage grows via import in later phases.

BEGIN;

CREATE TEMP TABLE _loc (
    path TEXT PRIMARY KEY,          -- slash-separated slug path from country
    location_type location_type NOT NULL,
    name TEXT NOT NULL,
    admin_code TEXT,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6)
);

CREATE TEMP TABLE _path_ids (
    path TEXT PRIMARY KEY,
    id UUID NOT NULL
);

-- Country
INSERT INTO _loc VALUES
('gb', 'country', 'United Kingdom', 'GB', 54.000000, -2.000000);

-- Nations
INSERT INTO _loc VALUES
('gb/england', 'nation', 'England', 'E92000001', 52.355500, -1.174300),
('gb/scotland', 'nation', 'Scotland', 'S92000003', 56.490700, -4.202600),
('gb/wales', 'nation', 'Wales', 'W92000004', 52.130700, -3.783700),
('gb/northern-ireland', 'nation', 'Northern Ireland', 'N92000002', 54.787700, -6.492300);

-- English counties / major admin areas
INSERT INTO _loc (path, location_type, name) VALUES
('gb/england/bedfordshire', 'county', 'Bedfordshire'),
('gb/england/berkshire', 'county', 'Berkshire'),
('gb/england/bristol', 'unitary_authority', 'Bristol'),
('gb/england/buckinghamshire', 'county', 'Buckinghamshire'),
('gb/england/cambridgeshire', 'county', 'Cambridgeshire'),
('gb/england/cheshire', 'county', 'Cheshire'),
('gb/england/cornwall', 'county', 'Cornwall'),
('gb/england/cumbria', 'county', 'Cumbria'),
('gb/england/derbyshire', 'county', 'Derbyshire'),
('gb/england/devon', 'county', 'Devon'),
('gb/england/dorset', 'county', 'Dorset'),
('gb/england/durham', 'county', 'Durham'),
('gb/england/east-sussex', 'county', 'East Sussex'),
('gb/england/east-riding-of-yorkshire', 'county', 'East Riding of Yorkshire'),
('gb/england/essex', 'county', 'Essex'),
('gb/england/gloucestershire', 'county', 'Gloucestershire'),
('gb/england/greater-london', 'county', 'Greater London'),
('gb/england/greater-manchester', 'county', 'Greater Manchester'),
('gb/england/hampshire', 'county', 'Hampshire'),
('gb/england/herefordshire', 'county', 'Herefordshire'),
('gb/england/hertfordshire', 'county', 'Hertfordshire'),
('gb/england/isle-of-wight', 'county', 'Isle of Wight'),
('gb/england/kent', 'county', 'Kent'),
('gb/england/lancashire', 'county', 'Lancashire'),
('gb/england/leicestershire', 'county', 'Leicestershire'),
('gb/england/lincolnshire', 'county', 'Lincolnshire'),
('gb/england/merseyside', 'county', 'Merseyside'),
('gb/england/norfolk', 'county', 'Norfolk'),
('gb/england/north-yorkshire', 'county', 'North Yorkshire'),
('gb/england/northamptonshire', 'county', 'Northamptonshire'),
('gb/england/northumberland', 'county', 'Northumberland'),
('gb/england/nottinghamshire', 'county', 'Nottinghamshire'),
('gb/england/oxfordshire', 'county', 'Oxfordshire'),
('gb/england/rutland', 'county', 'Rutland'),
('gb/england/shropshire', 'county', 'Shropshire'),
('gb/england/somerset', 'county', 'Somerset'),
('gb/england/south-yorkshire', 'county', 'South Yorkshire'),
('gb/england/staffordshire', 'county', 'Staffordshire'),
('gb/england/suffolk', 'county', 'Suffolk'),
('gb/england/surrey', 'county', 'Surrey'),
('gb/england/tyne-and-wear', 'county', 'Tyne and Wear'),
('gb/england/warwickshire', 'county', 'Warwickshire'),
('gb/england/west-midlands', 'county', 'West Midlands'),
('gb/england/west-sussex', 'county', 'West Sussex'),
('gb/england/west-yorkshire', 'county', 'West Yorkshire'),
('gb/england/wiltshire', 'county', 'Wiltshire'),
('gb/england/worcestershire', 'county', 'Worcestershire');

-- Welsh principal areas
INSERT INTO _loc (path, location_type, name) VALUES
('gb/wales/blaenau-gwent', 'unitary_authority', 'Blaenau Gwent'),
('gb/wales/bridgend', 'unitary_authority', 'Bridgend'),
('gb/wales/caerphilly', 'unitary_authority', 'Caerphilly'),
('gb/wales/cardiff', 'unitary_authority', 'Cardiff'),
('gb/wales/carmarthenshire', 'county', 'Carmarthenshire'),
('gb/wales/ceredigion', 'county', 'Ceredigion'),
('gb/wales/conwy', 'unitary_authority', 'Conwy'),
('gb/wales/denbighshire', 'county', 'Denbighshire'),
('gb/wales/flintshire', 'county', 'Flintshire'),
('gb/wales/gwynedd', 'county', 'Gwynedd'),
('gb/wales/isle-of-anglesey', 'county', 'Isle of Anglesey'),
('gb/wales/merthyr-tydfil', 'unitary_authority', 'Merthyr Tydfil'),
('gb/wales/monmouthshire', 'county', 'Monmouthshire'),
('gb/wales/neath-port-talbot', 'unitary_authority', 'Neath Port Talbot'),
('gb/wales/newport', 'unitary_authority', 'Newport'),
('gb/wales/pembrokeshire', 'county', 'Pembrokeshire'),
('gb/wales/powys', 'county', 'Powys'),
('gb/wales/rhondda-cynon-taf', 'unitary_authority', 'Rhondda Cynon Taf'),
('gb/wales/swansea', 'unitary_authority', 'Swansea'),
('gb/wales/torfaen', 'unitary_authority', 'Torfaen'),
('gb/wales/vale-of-glamorgan', 'unitary_authority', 'Vale of Glamorgan'),
('gb/wales/wrexham', 'unitary_authority', 'Wrexham');

-- Scottish council areas
INSERT INTO _loc (path, location_type, name) VALUES
('gb/scotland/aberdeen-city', 'unitary_authority', 'Aberdeen City'),
('gb/scotland/aberdeenshire', 'county', 'Aberdeenshire'),
('gb/scotland/angus', 'county', 'Angus'),
('gb/scotland/argyll-and-bute', 'county', 'Argyll and Bute'),
('gb/scotland/clackmannanshire', 'county', 'Clackmannanshire'),
('gb/scotland/dumfries-and-galloway', 'county', 'Dumfries and Galloway'),
('gb/scotland/dundee-city', 'unitary_authority', 'Dundee City'),
('gb/scotland/east-ayrshire', 'county', 'East Ayrshire'),
('gb/scotland/east-dunbartonshire', 'county', 'East Dunbartonshire'),
('gb/scotland/east-lothian', 'county', 'East Lothian'),
('gb/scotland/east-renfrewshire', 'county', 'East Renfrewshire'),
('gb/scotland/edinburgh', 'unitary_authority', 'City of Edinburgh'),
('gb/scotland/falkirk', 'county', 'Falkirk'),
('gb/scotland/fife', 'county', 'Fife'),
('gb/scotland/glasgow-city', 'unitary_authority', 'Glasgow City'),
('gb/scotland/highland', 'county', 'Highland'),
('gb/scotland/inverclyde', 'county', 'Inverclyde'),
('gb/scotland/midlothian', 'county', 'Midlothian'),
('gb/scotland/moray', 'county', 'Moray'),
('gb/scotland/north-ayrshire', 'county', 'North Ayrshire'),
('gb/scotland/north-lanarkshire', 'county', 'North Lanarkshire'),
('gb/scotland/orkney-islands', 'county', 'Orkney Islands'),
('gb/scotland/perth-and-kinross', 'county', 'Perth and Kinross'),
('gb/scotland/renfrewshire', 'county', 'Renfrewshire'),
('gb/scotland/scottish-borders', 'county', 'Scottish Borders'),
('gb/scotland/shetland-islands', 'county', 'Shetland Islands'),
('gb/scotland/south-ayrshire', 'county', 'South Ayrshire'),
('gb/scotland/south-lanarkshire', 'county', 'South Lanarkshire'),
('gb/scotland/stirling', 'county', 'Stirling'),
('gb/scotland/west-dunbartonshire', 'county', 'West Dunbartonshire'),
('gb/scotland/west-lothian', 'county', 'West Lothian'),
('gb/scotland/western-isles', 'county', 'Na h-Eileanan Siar');

-- Northern Ireland counties
INSERT INTO _loc (path, location_type, name) VALUES
('gb/northern-ireland/antrim', 'county', 'County Antrim'),
('gb/northern-ireland/armagh', 'county', 'County Armagh'),
('gb/northern-ireland/down', 'county', 'County Down'),
('gb/northern-ireland/fermanagh', 'county', 'County Fermanagh'),
('gb/northern-ireland/londonderry', 'county', 'County Londonderry'),
('gb/northern-ireland/tyrone', 'county', 'County Tyrone');

-- Major cities / towns (England)
INSERT INTO _loc (path, location_type, name, latitude, longitude) VALUES
('gb/england/greater-london/london', 'city', 'London', 51.507400, -0.127800),
('gb/england/west-midlands/birmingham', 'city', 'Birmingham', 52.486200, -1.890400),
('gb/england/greater-manchester/manchester', 'city', 'Manchester', 53.480800, -2.242600),
('gb/england/merseyside/liverpool', 'city', 'Liverpool', 53.408400, -2.991600),
('gb/england/west-yorkshire/leeds', 'city', 'Leeds', 53.800800, -1.549100),
('gb/england/south-yorkshire/sheffield', 'city', 'Sheffield', 53.381100, -1.470100),
('gb/england/tyne-and-wear/newcastle-upon-tyne', 'city', 'Newcastle upon Tyne', 54.978300, -1.617800),
('gb/england/bristol/bristol', 'city', 'Bristol', 51.454500, -2.587900),
('gb/england/nottinghamshire/nottingham', 'city', 'Nottingham', 52.954800, -1.158100),
('gb/england/hampshire/southampton', 'city', 'Southampton', 50.909700, -1.404400),
('gb/england/hampshire/portsmouth', 'city', 'Portsmouth', 50.819800, -1.088000),
('gb/england/leicestershire/leicester', 'city', 'Leicester', 52.636900, -1.139800),
('gb/england/norfolk/norwich', 'city', 'Norwich', 52.630900, 1.297400),
('gb/england/oxfordshire/oxford', 'city', 'Oxford', 51.752000, -1.257700),
('gb/england/cambridgeshire/cambridge', 'city', 'Cambridge', 52.205300, 0.121800),
('gb/england/devon/exeter', 'city', 'Exeter', 50.718400, -3.533900),
('gb/england/devon/plymouth', 'city', 'Plymouth', 50.375500, -4.142700),
('gb/england/cornwall/truro', 'city', 'Truro', 50.266000, -5.052700),
('gb/england/kent/canterbury', 'city', 'Canterbury', 51.280200, 1.078900),
('gb/england/kent/maidstone', 'town', 'Maidstone', 51.270400, 0.522700),
('gb/england/surrey/guildford', 'town', 'Guildford', 51.236200, -0.570400),
('gb/england/east-sussex/brighton', 'city', 'Brighton', 50.822500, -0.137200),
('gb/england/west-sussex/crawley', 'town', 'Crawley', 51.109200, -0.187200),
('gb/england/essex/chelmsford', 'city', 'Chelmsford', 51.735600, 0.468500),
('gb/england/essex/southend-on-sea', 'city', 'Southend-on-Sea', 51.545900, 0.707700),
('gb/england/hertfordshire/watford', 'town', 'Watford', 51.656500, -0.390300),
('gb/england/hertfordshire/st-albans', 'city', 'St Albans', 51.755000, -0.336000),
('gb/england/bedfordshire/luton', 'town', 'Luton', 51.878700, -0.420000),
('gb/england/buckinghamshire/milton-keynes', 'town', 'Milton Keynes', 52.040600, -0.759400),
('gb/england/berkshire/reading', 'town', 'Reading', 51.454300, -0.978100),
('gb/england/berkshire/slough', 'town', 'Slough', 51.510500, -0.595000),
('gb/england/gloucestershire/gloucester', 'city', 'Gloucester', 51.864200, -2.238200),
('gb/england/gloucestershire/cheltenham', 'town', 'Cheltenham', 51.899400, -2.078300),
('gb/england/somerset/bath', 'city', 'Bath', 51.381100, -2.359000),
('gb/england/somerset/taunton', 'town', 'Taunton', 51.015000, -3.103000),
('gb/england/dorset/bournemouth', 'town', 'Bournemouth', 50.719200, -1.880800),
('gb/england/wiltshire/swindon', 'town', 'Swindon', 51.555800, -1.779700),
('gb/england/wiltshire/salisbury', 'city', 'Salisbury', 51.068800, -1.794500),
('gb/england/warwickshire/warwick', 'town', 'Warwick', 52.281900, -1.584500),
('gb/england/west-midlands/coventry', 'city', 'Coventry', 52.406800, -1.519700),
('gb/england/west-midlands/wolverhampton', 'city', 'Wolverhampton', 52.586200, -2.128800),
('gb/england/staffordshire/stoke-on-trent', 'city', 'Stoke-on-Trent', 53.002700, -2.179400),
('gb/england/cheshire/chester', 'city', 'Chester', 53.193400, -2.893100),
('gb/england/lancashire/preston', 'city', 'Preston', 53.763200, -2.703100),
('gb/england/lancashire/blackpool', 'town', 'Blackpool', 53.817500, -3.035700),
('gb/england/cumbria/carlisle', 'city', 'Carlisle', 54.895100, -2.938200),
('gb/england/northumberland/hexham', 'town', 'Hexham', 54.971700, -2.101000),
('gb/england/durham/durham', 'city', 'Durham', 54.776100, -1.573300),
('gb/england/north-yorkshire/york', 'city', 'York', 53.960000, -1.087300),
('gb/england/north-yorkshire/harrogate', 'town', 'Harrogate', 53.992100, -1.541800),
('gb/england/west-yorkshire/bradford', 'city', 'Bradford', 53.796000, -1.759400),
('gb/england/west-yorkshire/huddersfield', 'town', 'Huddersfield', 53.645800, -1.785000),
('gb/england/south-yorkshire/doncaster', 'town', 'Doncaster', 53.522800, -1.128500),
('gb/england/lincolnshire/lincoln', 'city', 'Lincoln', 53.230700, -0.540600),
('gb/england/derbyshire/derby', 'city', 'Derby', 52.922500, -1.474600),
('gb/england/northamptonshire/northampton', 'town', 'Northampton', 52.240500, -0.902700),
('gb/england/suffolk/ipswich', 'town', 'Ipswich', 52.056700, 1.148200),
('gb/england/worcestershire/worcester', 'city', 'Worcester', 52.193600, -2.221600),
('gb/england/shropshire/shrewsbury', 'town', 'Shrewsbury', 52.707300, -2.755300),
('gb/england/herefordshire/hereford', 'city', 'Hereford', 52.056200, -2.716000),
('gb/england/isle-of-wight/newport-iow', 'town', 'Newport', 50.699500, -1.295000);

-- Wales cities / towns
INSERT INTO _loc (path, location_type, name, latitude, longitude) VALUES
('gb/wales/cardiff/cardiff', 'city', 'Cardiff', 51.481600, -3.179100),
('gb/wales/swansea/swansea', 'city', 'Swansea', 51.621400, -3.943600),
('gb/wales/newport/newport', 'city', 'Newport', 51.584200, -2.997700),
('gb/wales/wrexham/wrexham', 'town', 'Wrexham', 53.043000, -2.992500),
('gb/wales/carmarthenshire/carmarthen', 'town', 'Carmarthen', 51.856000, -4.312000),
('gb/wales/carmarthenshire/llanelli', 'town', 'Llanelli', 51.681000, -4.162000),
('gb/wales/pembrokeshire/haverfordwest', 'town', 'Haverfordwest', 51.801700, -4.969300),
('gb/wales/gwynedd/bangor', 'city', 'Bangor', 53.227400, -4.129300),
('gb/wales/conwy/llandudno', 'town', 'Llandudno', 53.324700, -3.827000),
('gb/wales/powys/brecon', 'town', 'Brecon', 51.947000, -3.389000),
('gb/wales/bridgend/bridgend', 'town', 'Bridgend', 51.507000, -3.577000),
('gb/wales/neath-port-talbot/neath', 'town', 'Neath', 51.662000, -3.804000),
('gb/wales/vale-of-glamorgan/barry', 'town', 'Barry', 51.399000, -3.284000),
('gb/wales/ceredigion/aberystwyth', 'town', 'Aberystwyth', 52.415000, -4.082900);

-- Scotland cities / towns
INSERT INTO _loc (path, location_type, name, latitude, longitude) VALUES
('gb/scotland/glasgow-city/glasgow', 'city', 'Glasgow', 55.864200, -4.251800),
('gb/scotland/edinburgh/edinburgh', 'city', 'Edinburgh', 55.953300, -3.188300),
('gb/scotland/aberdeen-city/aberdeen', 'city', 'Aberdeen', 57.149700, -2.094300),
('gb/scotland/dundee-city/dundee', 'city', 'Dundee', 56.462000, -2.970700),
('gb/scotland/stirling/stirling', 'city', 'Stirling', 56.116500, -3.936900),
('gb/scotland/fife/kirkcaldy', 'town', 'Kirkcaldy', 56.110700, -3.160200),
('gb/scotland/highland/inverness', 'city', 'Inverness', 57.477800, -4.224700),
('gb/scotland/perth-and-kinross/perth', 'city', 'Perth', 56.395000, -3.430800),
('gb/scotland/south-lanarkshire/hamilton', 'town', 'Hamilton', 55.777000, -4.053000),
('gb/scotland/north-lanarkshire/motherwell', 'town', 'Motherwell', 55.789000, -3.992000),
('gb/scotland/renfrewshire/paisley', 'town', 'Paisley', 55.845600, -4.423400),
('gb/scotland/west-lothian/livingston', 'town', 'Livingston', 55.886000, -3.523000),
('gb/scotland/dumfries-and-galloway/dumfries', 'town', 'Dumfries', 55.070000, -3.605000),
('gb/scotland/scottish-borders/galashiels', 'town', 'Galashiels', 55.614000, -2.808000);

-- Northern Ireland cities / towns
INSERT INTO _loc (path, location_type, name, latitude, longitude) VALUES
('gb/northern-ireland/antrim/belfast', 'city', 'Belfast', 54.597300, -5.930100),
('gb/northern-ireland/londonderry/derry', 'city', 'Derry', 54.996600, -7.308600),
('gb/northern-ireland/armagh/armagh', 'city', 'Armagh', 54.350300, -6.652800),
('gb/northern-ireland/down/newry', 'city', 'Newry', 54.175100, -6.340200),
('gb/northern-ireland/down/lisburn', 'city', 'Lisburn', 54.511800, -6.045000),
('gb/northern-ireland/antrim/ballymena', 'town', 'Ballymena', 54.863000, -6.276000),
('gb/northern-ireland/tyrone/omagh', 'town', 'Omagh', 54.597700, -7.310000),
('gb/northern-ireland/fermanagh/enniskillen', 'town', 'Enniskillen', 54.343900, -7.631700);

-- Insert depth-first; resolve parents via path map
DO $$
DECLARE
    r RECORD;
    parent_path TEXT;
    parent_uuid UUID;
    new_id UUID;
    leaf_slug TEXT;
    depth INT;
BEGIN
    FOR r IN
        SELECT *,
               length(path) - length(replace(path, '/', '')) AS depth
        FROM _loc
        ORDER BY depth, path
    LOOP
        leaf_slug := regexp_replace(r.path, '^.*/', '');
        parent_uuid := NULL;

        IF position('/' IN r.path) > 0 THEN
            parent_path := regexp_replace(r.path, '/[^/]+$', '');
            SELECT id INTO parent_uuid FROM _path_ids WHERE path = parent_path;
            IF parent_uuid IS NULL THEN
                RAISE EXCEPTION 'Missing parent for path % (expected %)', r.path, parent_path;
            END IF;
        END IF;

        INSERT INTO locations (
            parent_id, country_code, location_type, slug, name,
            name_normalised, admin_code, latitude, longitude
        ) VALUES (
            parent_uuid,
            'GB',
            r.location_type,
            leaf_slug,
            r.name,
            lower(unaccent(trim(r.name))),
            r.admin_code,
            r.latitude,
            r.longitude
        )
        RETURNING id INTO new_id;

        INSERT INTO _path_ids (path, id) VALUES (r.path, new_id);
    END LOOP;
END $$;

DROP TABLE _path_ids;
DROP TABLE _loc;

COMMIT;
