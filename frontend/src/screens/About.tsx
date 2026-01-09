import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import './styles/About.css';

gsap.registerPlugin(ScrollTrigger);

//해결해야하는 문제, About에서 다른 페이지로 이동하면 에러
//chunk-6BKLQ22S.js?v=c4727676:8456 Uncaught NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.
//해결방법: useEffect에서 ScrollTrigger를 제거해주어야함
//참고: https://greensock.com/forums/topic/27138-scrolltrigger-destroy-on-component-unmount/
function About() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const containers = gsap.utils.toArray<HTMLElement>(".container");

    containers.forEach((container) => {
      const sections = container.querySelectorAll(".panel");

      gsap.to(sections, {
        xPercent: -100 * (sections.length - 1),
        ease: "none",
        scrollTrigger: {
          trigger: container,
          pin: true,
          scrub: 1,
          end: "+=3500",
        },
      });
    });

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return (
    <>
      <div className="container" ref={containerRef}>
        <div className="description panel blue">
          <div>
            <h1>Mixed horizontal and vertical scrolling sections (simple)</h1>
            <p>Scroll vertically to scrub the horizontal animations and also scroll through the vertical sections</p>
            <div className="scroll-down">
              Scroll down
              <div className="arrow"></div>
            </div>
          </div>
        </div>

        <section className="panel red">ONE</section>
        <section className="panel orange">TWO</section>
        <section className="panel purple">THREE</section>
        <section className="panel green">FOUR</section>
        <section className="panel gray">FIVE</section>
      </div>

      <section className="panel red">vertical</section>
      <section className="panel orange">vertical</section>
      <section className="panel purple">vertical</section>
      <section className="panel green">vertical</section>

      <div className="container" ref={containerRef}>
        <section className="panel red">ONE</section>
        <section className="panel orange">TWO</section>
        <section className="panel purple">THREE</section>
        <section className="panel green">FOUR</section>
        <section className="panel gray">FIVE</section>
      </div>
    </>
  );
}

export default About;
