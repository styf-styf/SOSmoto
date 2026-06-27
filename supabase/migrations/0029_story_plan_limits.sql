-- Ajusta los límites de historias por plan a un tope fijo por día
-- (antes: free=0, standard=3, pro=ilimitado).
update subscription_plans set max_active_stories = 1 where name = 'free';
update subscription_plans set max_active_stories = 3 where name = 'standard';
update subscription_plans set max_active_stories = 5 where name = 'pro';
