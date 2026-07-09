--
-- PostgreSQL database dump
--

\restrict dKh59nChWhM7nVcvssJrBN6M40FQnTY4gmHvQO9Hg3O7LCDYiHuBykZPede9cyK

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: prizes; Type: TABLE; Schema: public; Owner: wheellive
--

CREATE TABLE public.prizes (
    id text NOT NULL,
    name text NOT NULL,
    weight double precision NOT NULL,
    stock integer,
    color text NOT NULL,
    icon text NOT NULL,
    active integer DEFAULT 1 NOT NULL,
    created_at bigint NOT NULL
);


ALTER TABLE public.prizes OWNER TO wheellive;

--
-- Name: queue_entries; Type: TABLE; Schema: public; Owner: wheellive
--

CREATE TABLE public.queue_entries (
    id text NOT NULL,
    buyer_name text NOT NULL,
    spins_total integer NOT NULL,
    spins_remaining integer NOT NULL,
    note text,
    created_at bigint NOT NULL
);


ALTER TABLE public.queue_entries OWNER TO wheellive;

--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: wheellive
--

CREATE TABLE public.schema_migrations (
    version integer NOT NULL,
    applied_at bigint NOT NULL
);


ALTER TABLE public.schema_migrations OWNER TO wheellive;

--
-- Name: settings; Type: TABLE; Schema: public; Owner: wheellive
--

CREATE TABLE public.settings (
    key text NOT NULL,
    value text NOT NULL
);


ALTER TABLE public.settings OWNER TO wheellive;

--
-- Name: spins; Type: TABLE; Schema: public; Owner: wheellive
--

CREATE TABLE public.spins (
    id text NOT NULL,
    entry_id text NOT NULL,
    buyer_name text NOT NULL,
    prize_id text NOT NULL,
    prize_name text NOT NULL,
    target_segment_index integer NOT NULL,
    duration_ms integer NOT NULL,
    extra_rotations integer NOT NULL,
    status text NOT NULL,
    started_at bigint NOT NULL,
    completed_at bigint
);


ALTER TABLE public.spins OWNER TO wheellive;

--
-- Data for Name: prizes; Type: TABLE DATA; Schema: public; Owner: wheellive
--

COPY public.prizes (id, name, weight, stock, color, icon, active, created_at) FROM stdin;
prize-19e7f7b3-c348-437f-b790-ad7ba6b53dc2	Pantalón Premium	1	5	#E63946	prize-jeans	1	1783560442542
prize-18d1ec6a-d1ba-455d-896e-2ede82a4eb39	10% Descuento	4	\N	#457B9D	prize-discount	1	1783560442543
prize-4ac0720a-0969-4d78-a075-93991227c82b	Envío Gratis	3	\N	#2A9D8F	prize-shipping	1	1783560442543
prize-a7eeebb7-10bf-4992-9a9c-bcacd1d537aa	Gorra Exclusiva	2	10	#E9C46A	prize-cap	1	1783560442544
\.


--
-- Data for Name: queue_entries; Type: TABLE DATA; Schema: public; Owner: wheellive
--

COPY public.queue_entries (id, buyer_name, spins_total, spins_remaining, note, created_at) FROM stdin;
entry-bb9a1a7b-4f75-4c7f-aa34-1609682d9acf	PruebaDocker	1	0	\N	1783560479758
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: wheellive
--

COPY public.schema_migrations (version, applied_at) FROM stdin;
1	1783560442538
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: wheellive
--

COPY public.settings (key, value) FROM stdin;
chest_state	{"keys":1,"keysTarget":5,"prize":"🎁 Premio Sorpresa","status":"locked"}
\.


--
-- Data for Name: spins; Type: TABLE DATA; Schema: public; Owner: wheellive
--

COPY public.spins (id, entry_id, buyer_name, prize_id, prize_name, target_segment_index, duration_ms, extra_rotations, status, started_at, completed_at) FROM stdin;
spin-4655ac16-a0d7-4a83-b74b-c10183c75a07	entry-bb9a1a7b-4f75-4c7f-aa34-1609682d9acf	PruebaDocker	prize-18d1ec6a-d1ba-455d-896e-2ede82a4eb39	10% Descuento	1	8000	5	completed	1783560479769	1783560485784
\.


--
-- Name: prizes prizes_pkey; Type: CONSTRAINT; Schema: public; Owner: wheellive
--

ALTER TABLE ONLY public.prizes
    ADD CONSTRAINT prizes_pkey PRIMARY KEY (id);


--
-- Name: queue_entries queue_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: wheellive
--

ALTER TABLE ONLY public.queue_entries
    ADD CONSTRAINT queue_entries_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: wheellive
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: wheellive
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: spins spins_pkey; Type: CONSTRAINT; Schema: public; Owner: wheellive
--

ALTER TABLE ONLY public.spins
    ADD CONSTRAINT spins_pkey PRIMARY KEY (id);


--
-- Name: idx_spins_completed_at; Type: INDEX; Schema: public; Owner: wheellive
--

CREATE INDEX idx_spins_completed_at ON public.spins USING btree (completed_at);


--
-- Name: idx_spins_status; Type: INDEX; Schema: public; Owner: wheellive
--

CREATE INDEX idx_spins_status ON public.spins USING btree (status);


--
-- PostgreSQL database dump complete
--

\unrestrict dKh59nChWhM7nVcvssJrBN6M40FQnTY4gmHvQO9Hg3O7LCDYiHuBykZPede9cyK

