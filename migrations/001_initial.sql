CREATE TABLE users (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 first_name text NOT NULL CHECK(length(first_name) BETWEEN 1 AND 80),
 last_name text NOT NULL CHECK(length(last_name) BETWEEN 1 AND 80),
 email text NOT NULL UNIQUE CHECK(email=lower(email)), phone text NOT NULL,
 password_hash text NOT NULL,
 role text NOT NULL CHECK(role IN ('supporter','social_worker','admin')),
 approved boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (token_hash text PRIMARY KEY,user_id bigint NOT NULL REFERENCES users(id),expires_at timestamptz NOT NULL);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE TABLE login_limits (key text PRIMARY KEY, attempts integer NOT NULL, reset_at timestamptz NOT NULL);
CREATE TABLE catalog (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,name text NOT NULL UNIQUE);
INSERT INTO catalog(name) VALUES ('Bed'),('Mattress'),('Bed Frame'),('Bedding'),('Pillows'),('Dishes'),('Glasses'),('Silverware'),('Pots and Pans'),('Cooking Utensils'),('Microwave'),('Television'),('Lamp'),('Kitchen Table'),('Dining Chairs'),('Sofa'),('Coffee Table'),('End Table'),('Dresser'),('Towels'),('Other');
CREATE TABLE requests (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 number text GENERATED ALWAYS AS ('HTA-' || lpad(id::text,greatest(5,length(id::text)), '0')) STORED UNIQUE,
 owner_id bigint NOT NULL REFERENCES users(id),
 narrative text NOT NULL CHECK(length(narrative) BETWEEN 1 AND 10000),
 summary text NOT NULL CHECK(length(summary) BETWEEN 1 AND 2000),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),closed_at timestamptz
);
CREATE TABLE request_items (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 request_id bigint NOT NULL REFERENCES requests(id),catalog_id integer NOT NULL REFERENCES catalog(id),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),quantity integer NOT NULL CHECK(quantity>0),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX request_items_request_idx ON request_items(request_id);
CREATE TABLE commitments (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,item_id bigint NOT NULL REFERENCES request_items(id),supporter_id bigint NOT NULL REFERENCES users(id),
 quantity integer NOT NULL CHECK(quantity>=0),received integer NOT NULL DEFAULT 0 CHECK(received>=0 AND received<=quantity),
 status text NOT NULL DEFAULT 'committed' CHECK(status IN ('committed','received','cancelled')),
 CHECK((status='cancelled' AND quantity=0 AND received=0) OR (status='committed' AND quantity>received) OR (status='received' AND quantity>0 AND quantity=received)),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX commitments_item_idx ON commitments(item_id);
CREATE INDEX commitments_supporter_idx ON commitments(supporter_id);
CREATE TABLE receipts (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,commitment_id bigint NOT NULL REFERENCES commitments(id),quantity integer NOT NULL CHECK(quantity>0),recorded_by bigint NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE audit_history (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor_id bigint REFERENCES users(id),action text NOT NULL,request_id bigint REFERENCES requests(id),details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
-- All inventory writes serialize on the parent request. Triggers also guard direct SQL writes.
CREATE FUNCTION guard_commitment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE req bigint; req_status text; needed integer; reserved bigint;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.item_id<>OLD.item_id OR NEW.supporter_id<>OLD.supporter_id) THEN RAISE EXCEPTION 'Commitment identity is immutable'; END IF;
 SELECT request_id INTO req FROM request_items WHERE id=NEW.item_id;
 SELECT status INTO req_status FROM requests WHERE id=req FOR UPDATE;
 SELECT quantity INTO needed FROM request_items WHERE id=NEW.item_id;
 SELECT COALESCE(sum(quantity),0) INTO reserved FROM commitments WHERE item_id=NEW.item_id AND id<>NEW.id;
 IF reserved+NEW.quantity>needed THEN RAISE EXCEPTION 'Quantity exceeds available items'; END IF;
 IF req_status='closed' AND (TG_OP='INSERT' OR NEW.quantity>OLD.quantity) THEN RAISE EXCEPTION 'Request is closed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER commitment_quantity_guard BEFORE INSERT OR UPDATE ON commitments FOR EACH ROW EXECUTE FUNCTION guard_commitment();
CREATE FUNCTION guard_item() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reserved bigint;
BEGIN
 IF NEW.request_id<>OLD.request_id THEN RAISE EXCEPTION 'Item request is immutable'; END IF;
 PERFORM id FROM requests WHERE id=NEW.request_id FOR UPDATE;
 SELECT COALESCE(sum(quantity),0) INTO reserved FROM commitments WHERE item_id=NEW.id;
 IF NEW.quantity<reserved THEN RAISE EXCEPTION 'Quantity is below commitments'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER item_quantity_guard BEFORE UPDATE ON request_items FOR EACH ROW EXECUTE FUNCTION guard_item();
