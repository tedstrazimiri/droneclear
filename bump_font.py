import re

paths = [
    'C:/Users/Ted/Documents/DRONECLEAR/DroneClear Components Visualizer/style.css'
]

def repl(m):
    val = float(m.group(1))
    new_val = int(round(val * 1.15)) # 15% bigger
    return f'font-size: {new_val}px'

for path in paths:
    with open(path, 'r') as f:
        content = f.read()

    new_content = re.sub(r'font-size:\s*([\d\.]+)px', repl, content)

    wave_css = """
.main-content::before {
    content: '';
    position: absolute;
    bottom: -60vw;
    left: -60vw;
    width: 150vw;
    height: 150vw;
    background: repeating-radial-gradient(
        circle at 45% 55%, 
        transparent 0,
        transparent 80px,
        rgba(218, 41, 28, 0.05) 80px,
        rgba(218, 41, 28, 0.05) 160px,
        transparent 160px,
        transparent 240px,
        rgba(2, 132, 199, 0.04) 240px,
        rgba(2, 132, 199, 0.04) 320px
    );
    filter: blur(15px);
    z-index: 0;
    pointer-events: none;
    border-radius: 50%;
}

.fab-bottom-right {
    position: fixed;
    bottom: 30px;
    right: 30px;
    z-index: 1000;
    box-shadow: 0 10px 25px rgba(218, 41, 28, 0.3);
    padding: 16px 24px;
    border-radius: 30px;
    font-size: 16px;
    background: linear-gradient(135deg, var(--accent-red), var(--accent-darkred));
    color: white;
    font-weight: 700;
    cursor: pointer;
    border: none;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
}

.fab-bottom-right:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 15px 35px rgba(218, 41, 28, 0.4);
}
"""
    if '.main-content::before' not in new_content:
        new_content += wave_css

    with open(path, 'w') as f:
        f.write(new_content)
    
print('Done!')
