import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { canCreate } from "@/lib/types";
import { Flash, type Params } from "@/components/ui";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await currentUser();
  return (
    <>
      <Flash params={await searchParams} />
      <section className="hero">
        <div>
          <p className="eyebrow">A community that shows up</p>
          <h1>
            A new home.
            <br />A fresh start.
            <br />
            <em>A helping hand.</em>
          </h1>
          <p className="hero-subtitle">
            Helping neighbors make a house a home.
          </p>
          <p className="muted lead">
            Help neighbors moving from shelter into permanent housing find the
            everyday essentials that turn an empty space into a place to belong.
          </p>
          <div className="actions">
            <Link className="button" href="/requests">
              View Existing Requests <span aria-hidden="true">→</span>
            </Link>
            <Link
              className="button secondary"
              href={
                !user
                  ? "/register"
                  : canCreate(user)
                    ? "/requests/new"
                    : "/commitments"
              }
            >
              {!user
                ? "Create New Account"
                : canCreate(user)
                  ? "Create New Request"
                  : "My Commitments"}
            </Link>
          </div>
          <div className="hero-note">
            <span aria-hidden="true">♡</span> Small acts of kindness. Meaningful
            new beginnings.
          </div>
        </div>
        <div
          className="home-art"
          role="img"
          aria-label="An illustration of a welcoming home with furniture, a lamp, and a houseplant"
        >
          <div className="art-sun" />
          <div className="art-window">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="art-picture">♡</div>
          <div className="art-lamp">
            <i />
          </div>
          <div className="art-sofa">
            <i />
            <i />
            <i />
          </div>
          <div className="art-rug" />
          <div className="art-plant">
            <i />
            <i />
            <i />
            <b />
          </div>
          <div className="art-caption">
            <span>⌂</span>
            <div>
              A place to belong
              <small>Built together, one essential at a time.</small>
            </div>
          </div>
        </div>
      </section>
      <section className="how">
        <div className="section-heading">
          <p className="eyebrow">How we help, together</p>
          <h2>Every essential makes a difference.</h2>
          <p className="muted">
            A simple way to connect real needs with a caring community.
          </p>
        </div>
        <div className="three-grid">
          <article className="step">
            <span>01</span>
            <h3>Share a household need</h3>
            <p>
              Approved social workers create confidential requests for neighbors
              beginning a new chapter.
            </p>
          </article>
          <article className="step">
            <span>02</span>
            <h3>Give what you can</h3>
            <p>
              Supporters choose specific household items and commit to the
              quantities they can provide.
            </p>
          </article>
          <article className="step">
            <span>03</span>
            <h3>Welcome someone home</h3>
            <p>
              Social workers confirm each delivery and track a household’s
              progress toward a furnished home.
            </p>
          </article>
        </div>
      </section>
      <section className="bottom-callout">
        <div>
          <h2>There’s a place for you here.</h2>
          <p>
            Join as a community supporter or request access as a social worker.
          </p>
        </div>
        <div className="actions">
          {!user && (
            <Link className="button" href="/login">
              Login
            </Link>
          )}
          {(!user || canCreate(user)) && (
            <Link className="button secondary" href="/requests/new">
              Create New Request
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
