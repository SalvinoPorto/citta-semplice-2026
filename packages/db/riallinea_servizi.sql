UPDATE public.servizi as d
	SET  area_id=s.area_id, ufficio_id=s.ufficio_id, titolo=s.titolo, sotto_titolo=s.sotto_titolo,
	descrizione=s.descrizione, come_fare=s.come_fare, cosa_serve=s.cosa_serve, altre_info=s.altre_info, 
    contatti=s.contatti, slug=s.slug, icona=s.icona, ordine=s.ordine, attributi=s.attributi, 
    campi_in_evidenza=s.campi_in_evidenza, campi_da_esportare=s.campi_da_esportare, post_form_validation=s.post_form_validation, 
    post_form_validation_api=s.post_form_validation_api, post_form_validation_fields=s.post_form_validation_fields, 
    data_inizio=s.data_inizio, data_fine=s.data_fine, unico_invio=s.unico_invio, unico_invio_per_utente=s.unico_invio_per_utente, 
    campi_unico_invio=s.campi_unico_invio, numero_max_istanze=s.numero_max_istanze, msg_sopra_soglia=s.msg_sopra_soglia, 
    msg_extra_servizio=s.msg_extra_servizio, evidenza=s.evidenza, attivo=s.attivo, created_at=s.created_at, updated_at=s.updated_at
    FROM servizi_tmp as s
	WHERE d.id=s.id;