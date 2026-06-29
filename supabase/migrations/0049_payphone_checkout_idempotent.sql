-- Si el navegador recarga la pagina de checkout de Payphone (ej. el celular
-- recarga la pestana en segundo plano mientras el usuario aprueba el pago en
-- la app de su wallet), volver a inicializar el widget de Payphone con el
-- mismo client_transaction_id falla con "Ya existe una transaccion con el
-- ClientTransactionId especificado" -- un error crudo, sin sentido para el
-- usuario, aunque el pago se procese bien por el webhook en paralelo. Esta
-- columna marca la primera vez que se sirvio el widget para un pago, para
-- que cargas posteriores redirijan a payphone-return (que ya sabe esperar y
-- confirmar el estado) en vez de reintentar el prepare con Payphone.
alter table payments add column checkout_opened_at timestamptz;
