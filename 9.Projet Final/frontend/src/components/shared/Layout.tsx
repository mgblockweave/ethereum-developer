import Header from "./Header";
import Footer from "./Footer";
import Image from "next/image";

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen flex flex-col relative bg-transparent">
      {/* Fixed background image with light overlay */}
      <div className="fixed inset-0 -z-20 overflow opacity-8">
        <Image
          src="/patridefi.png"
          alt="PatriDeFi background"
          fill
          priority
          className="object-cover opacity-100"
        />
        {/* Light white overlay for text readability */}
        <div className="absolute inset-0 bg-white/20" />
      </div>

{/*mx-auto flex w-full max-w-3xl items-center justify-center bg-zinc-50 font-sans dark:bg-black*/}
      <Header />

      {/* Main content - flex-1 to push footer down */}
      <main className="flex-1 relative z-10 w-full overflow-y-auto">
        <div className="max-w-6xl mx-auto w-full px-4 py-8 lg:py-12">
          {children}
        </div>
      </main>

      {/* Footer - always at bottom */}
      <Footer />
    </div>
  );
}

export default Layout;