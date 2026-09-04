import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() { return <><SiteHeader /><main id="main-content" className="prose-page"><span className="eyebrow">Off the map</span><h1>That territory does not exist.</h1><p className="prose-lede">The skill may have moved, or the link may be incomplete.</p><Link className="primary-button" href="/">Return to the map</Link></main></>; }
