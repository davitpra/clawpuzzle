import { Container } from "@/shared/ui/Container";
import { AllOrders } from "@/widgets/user-dashboard/ui/AllOrders";

export const metadata = {
  title: "My Orders — ClawPuzzle",
};

export default function UserOrdersPage() {
  return (
    <Container className="pb-10">
      <AllOrders />
    </Container>
  );
}
