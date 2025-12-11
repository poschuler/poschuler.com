import {Button, Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import {useState} from 'react';

export function Sheet() {
  const [isOpen, setOpen] = useState(false); 

  return (
    <>
      <Button
        className="text-blue-600 text-lg font-semibold outline-none rounded bg-transparent border-none pressed:text-blue-700 focus-visible:ring"
        onPress={() => setOpen(true)}
      >
        Open sheet
      </Button>
        {isOpen && (
          <ModalOverlay
            isOpen
            onOpenChange={setOpen}
            className="fixed inset-0 z-10"
          >
            <Modal
              className="bg-[--page-background] absolute bottom-0 w-full rounded-t-xl shadow-lg will-change-transform"
            >
              <div className="mx-auto w-12 mt-2 h-1.5 rounded-full bg-gray-400" />
              <Dialog className="px-4 pb-4 outline-none">
                <div className="flex justify-end">
                  <Button
                    className="text-blue-600 text-lg font-semibold mb-8 outline-none rounded bg-transparent border-none pressed:text-blue-700 focus-visible:ring"
                    onPress={() => setOpen(false)}
                  >
                    Done
                  </Button>
                </div>
                <Heading slot="title" className="text-3xl font-semibold mb-4">
                  Modal sheet
                </Heading>
                <p className="text-lg mb-4">
                  This is a dialog with a custom modal overlay built with React
                  Aria Components and Framer Motion.
                </p>
                <p className="text-lg">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                  Aenean sit amet nisl blandit, pellentesque eros eu,
                  scelerisque eros. Sed cursus urna at nunc lacinia dapibus.
                </p>
              </Dialog>
            </Modal>
          </ModalOverlay>
        )}
    </>
  );
}