import './styles/Button.css';


interface buttonStyle { 
    style: string;  // 버튼 스타일 클래스 이름
    size: string;   // 버튼 크기
    onClick?: () => void; // 클릭 이벤트 핸들러
    title: string; // 버튼 내부에 표시될 내용
}

function Button(props: buttonStyle) {
    return (
        <button className={`${props.style}-${props.size}-button`} onClick={props.onClick}>
            {props.title}
        </button>
    );
};

export default Button;