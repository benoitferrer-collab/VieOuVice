-- Catalogue de gameplay, coefficients fictifs. Aucun utilisateur fictif.
begin;
insert into public.action_catalog(id,label,kind,unit,max_quantity,coefficient,daily_cap,icon) values
('walk','Prendre l’air','health','balade de 20 min',3,25,75,'footprints'),
('sleep','Une bonne nuit','health','heure de sommeil',12,10,80,'moon'),
('move','Bouger un peu','health','séance douce',2,40,80,'activity'),
('pause','Une vraie pause','health','pause sans écran',3,15,45,'leaf'),
('drink','Un verre de trop','excess','verre déclaré',10,-30,0,'wine'),
('snack','Craquage gourmand','excess','craquage',5,-20,0,'pizza'),
('screen','Scroll sans fin','excess','heure d’écran tardif',8,-15,0,'phone'),
('night','Nuit écourtée','excess','nuit déclarée',1,-50,0,'coffee') on conflict(id) do nothing;
insert into public.trophy_definitions(code,label,description) values
('first-step','Premier souffle','Première déclaration confirmée.'),
('maine-coon','L’Esprit du Maine Coon','Condition avancée non activée dans cette version.'),
('grande-scopa','La Grande Scopa','Condition avancée non activée dans cette version.') on conflict(code) do nothing;
commit;
