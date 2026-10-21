import styles from "./landing-interactive-shell.module.css"

export function LandingInteractiveDemo() {
  return <section id="workspace" className={styles.section} aria-label="Explore Alook" data-testid="landing-interactive-section">
    <iframe src="/demo" title="Alook workspace" className={styles.frame} />
  </section>
}
