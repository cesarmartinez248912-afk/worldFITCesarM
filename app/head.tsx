export default function Head() {
  return (
    <>
      <meta name="theme-color" content="#121317" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="WorldFit" />
      <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      <link rel="manifest" href="/manifest.webmanifest" />
      <link rel="apple-touch-startup-image" href="/splash/iphone-portrait.png" />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            try {
              var theme = localStorage.getItem("pure-lift-theme") || "dark";
              document.documentElement.dataset.theme = theme;
              document.documentElement.classList.toggle("dark", theme === "dark");
              document.documentElement.classList.toggle("light", theme === "light");
            } catch (e) {}
          `,
        }}
      />
    </>
  );
}
