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

import { useBaseUrl } from "~/utils/use-base-url";
import slug from "slug";
import { useToast } from "~/components/ui/use-toast";
import { Link, Share2 } from "lucide-react";
import { Button as ChekaloButton } from "~/components/chekalo/Button";

type BigCardShareButtonProps = {
  idInventoryMasterProduct: string;
  productNameSlug: string;
  productName: string;
};

export default function BigCardShareButton({
  idInventoryMasterProduct,
  productNameSlug,
  productName,
}: BigCardShareButtonProps) {
  const baseUrl = useBaseUrl();
  const { toast } = useToast();
  const url = `${baseUrl}/${productNameSlug}/p`;

  return (
    <div>
      <Dialog>
        <DialogTrigger asChild>
          <ChekaloButton className={"flex items-center"}>
            <Share2 className="mr-2" size={15} />
            Compartir
          </ChekaloButton>
          {/* <Button variant={"default"} size={"default"} className={"w-full"}>
            
          </Button> */}
        </DialogTrigger>
        <DialogContent className="max-w-[250px] rounded-lg bg-app border border-default">
          <DialogHeader>
            <DialogTitle>Compartir</DialogTitle>
            <DialogDescription className="sr-only">
              Compartir producto en redes sociales
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-5 content-evenly items-center justify-evenly justify-items-center gap-4">
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
            <ChekaloButton
              variant="link"
              onPress={() => {
                navigator.clipboard.writeText(url);
                toast({
                  description: "Se copió el enlace",
                  duration: 500,
                });
              }}
            >
              <Link size={20} />
            </ChekaloButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
