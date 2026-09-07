# Domain glossary

- **Giftcard**: A store-associated monetary balance issued to a receiver. Its issued amount is fixed, while its remaining balance decreases through spends.
- **Spend**: A partial redemption of a giftcard, recorded as an immutable SpendsLog entry.
- **Current amount**: The remaining giftcard balance after subtracting all recorded spends from the issued amount.
- **Active giftcard**: A giftcard whose expiration is absent or has not passed at evaluation time.
- **Expired giftcard**: A giftcard whose expiration timestamp is before the evaluation time.
- **Store**: The merchant identified by `storeId` and owned by the Stores service.
