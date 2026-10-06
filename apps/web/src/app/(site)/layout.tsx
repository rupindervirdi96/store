/** Standard centred layout for every page except the full-bleed home page. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <main className="container-page py-8 sm:py-10">{children}</main>;
}
