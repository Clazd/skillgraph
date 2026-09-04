import Link from "next/link";

export function SiteHeader() {
  return <header className="site-header"><Link href="/" className="brand"><span className="brand-mark">SG</span><span><strong>SkillGraph</strong><small>Map what you can do</small></span></Link><nav><Link href="/">Explore</Link><Link href="/me">My map</Link><Link href="/domains">Domains</Link><Link href="/about">About</Link></nav><Link className="header-cta" href="/">Open the map</Link></header>;
}
