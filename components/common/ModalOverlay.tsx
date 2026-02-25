interface ModalOverlayProps {
    onClose: () => void;
    children: React.ReactNode;
    maxWidth?: string;
}

export default function ModalOverlay({ onClose, children, maxWidth = 'max-w-lg' }: ModalOverlayProps) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}></div>
            <div className={`bg-card border border-card-border w-full ${maxWidth} rounded-2xl relative z-10 p-10 shadow-2xl animate-in zoom-in-95 duration-200`}>
                {children}
            </div>
        </div>
    );
}
