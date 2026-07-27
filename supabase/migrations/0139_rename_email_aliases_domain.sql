-- sosmoto.app nunca se verificó en Resend; el dominio real comprado es sosmoto.net.
update email_aliases
set alias = replace(alias, '@sosmoto.app', '@sosmoto.net')
where alias like '%@sosmoto.app';
