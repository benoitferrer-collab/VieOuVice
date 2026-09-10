-- Ajouts au catalogue : barèmes de jeu fictifs, aucune estimation médicale.
-- Les anciennes catégories et les déclarations historiques restent inchangées.
begin;
insert into public.action_catalog(id,label,kind,unit,max_quantity,coefficient,daily_cap,icon) values
('cocktail-light','Cocktail léger / dilué','excess','cocktail',5,-25,0,'wine'),
('cocktail-strong','Cocktail fort / sucré','excess','cocktail',5,-45,0,'wine'),
('spirit-shot','Shot d’alcool fort','excess','shot',5,-30,0,'wine'),
('vegetables','Légumes frais / salade composée','health','portion',3,20,60,'leaf'),
('berries-nuts','Fruits rouges ou noix','health','portion',2,25,50,'leaf'),
('plant-meal','Repas végétalisé riche en fibres','health','repas',2,40,80,'leaf'),
('brisk-walk','Marche rapide de 30 minutes','health','marche de 30 min',2,90,180,'footprints'),
('short-nap','Sieste courte de 15 à 25 minutes','health','sieste',1,30,30,'moon'),
('restful-night','Nuit réparatrice de 7 à 8 heures','health','nuit',1,90,90,'moon'),
('calm-break','Déconnexion / repos calme','health','pause de 30 min',3,20,60,'leaf'),
('real-holiday','Vacances / vraie coupure','health','journée',1,180,180,'leaf'),
('standard-drink','Verre de vin ou bière standard','excess','verre',5,-20,0,'wine'),
('sweet-cocktail','Cocktail sucré (mojito, margarita)','excess','cocktail',5,-35,0,'wine'),
('heavy-meal','Repas lourd (fast-food, friture)','excess','repas',3,-45,0,'pizza'),
('processed-meat','Charcuterie / viande ultra-transformée','excess','portion',3,-30,0,'pizza'),
('stress-day','Journée de stress intense','excess','journée',1,-180,0,'activity'),
('sleepless-night','Nuit blanche ou sommeil inférieur à 5 h','excess','nuit',1,-150,0,'coffee'),
('cigarette','Cigarette','excess','cigarette',20,-12,0,'flame')
on conflict(id) do nothing;
commit;
