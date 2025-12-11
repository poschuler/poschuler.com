import { Share2 } from "lucide-react";
import { Button, buttonVariants } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

import {
  FacebookIcon,
  TelegramIcon,
  WhatsappIcon,
  XIcon,
  FacebookShareButton,
  TelegramShareButton,
  TwitterShareButton,
  WhatsappShareButton,
} from "react-share";

import { cn } from "~/lib/utils";
import { useBaseUrl } from "~/utils/misc";

type ShareButtonProps = {
  idInventoryProduct: string;
};

export default function DetailsShareButton({
  idInventoryProduct,
}: ShareButtonProps) {
  const baseUrl = useBaseUrl();
  const url = `${baseUrl}/app/products/${idInventoryProduct}`;

  return (
    <div>
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant={"default"}
            size={"default"}
            className={cn(buttonVariants({ variant: "default" }), "flex-grow")}
          >
            <Share2 className="h-4 w-4 md:mr-2" />
            <span className="hidden md:block">Compartir</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[250px] rounded-lg">
          <DialogHeader>
            <DialogTitle>Compartir</DialogTitle>
            <DialogDescription className="sr-only">
              Compartir producto en redes sociales
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-4 content-evenly items-center justify-evenly justify-items-center">
            <WhatsappShareButton
              url={url}
              title="Cheka esta oferta que encontré en chekalo.pe"
            >
              <WhatsappIcon size={32} round={true} />
            </WhatsappShareButton>

            <FacebookShareButton
              url={url}
              hashtag="#chekalo"
              title="Cheka esta oferta que encontré en chekalo.pe"
            >
              <FacebookIcon size={32} round={true} />
            </FacebookShareButton>

            <TelegramShareButton
              url={url}
              title="Cheka esta oferta que encontré en chekalo.pe"
            >
              <TelegramIcon size={32} round={true} />
            </TelegramShareButton>

            <TwitterShareButton
              url={url}
              title="Cheka esta oferta que encontré en chekalo.pe"
              hashtags={["chekalo"]}
            >
              <XIcon size={32} round={true} />
            </TwitterShareButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
