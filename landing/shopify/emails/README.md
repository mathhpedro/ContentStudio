# E-mail de confirmação/entrega — LEVVL

`order-confirmation.liquid` é o e-mail de **Confirmação de pedido** do Shopify, no design
LEVVL. É a notificação nativa enviada logo após a compra — para produto digital, é o e-mail
que entrega o acesso.

## Como instalar
1. Shopify Admin → **Configurações → Notificações → Confirmação de pedido**.
2. Clique em **Editar código** (ou no ícone `</>`).
3. Apague o conteúdo e cole o de `order-confirmation.liquid`.
4. **Salvar**. Use **“Enviar e-mail de teste”** para ver no seu inbox.

## Variáveis nativas do Shopify usadas
- `{{ customer.first_name }}` — nome do cliente
- `{{ order_name }}` — número do pedido (ex.: #1001)
- `{{ order_status_url }}` — link da página do pedido (onde ficam os downloads)
- `{% for line in subtotal_line_items %}` → `{{ line.title }}`, `{{ line.quantity }}`,
  `{{ line.variant.title }}`, `{{ line.final_line_price | money }}`, `{{ line | img_url: '200x' }}`
- `{{ subtotal_price | money }}`, `{{ total_discounts | money }}`, `{{ total_price | money }}`
- `{{ shop.name }}`, `{{ shop.email }}`

## Entrega do arquivo (importante)
O botão **“Acessar meu Playbook”** aponta para `{{ order_status_url }}` — a página do pedido,
onde o app de **entrega digital** (ex.: “Digital Downloads” da Shopify) exibe o botão de
download do PDF. Passos:
1. Instale um app de entrega digital e anexe o PDF ao produto.
2. Ele disponibiliza o download na página do pedido (o link do e-mail já leva pra lá).
3. Se o app fornecer uma variável/URL de download própria, dá pra trocar o `href` do botão
   por ela.

> Observação: e-mails têm suporte irregular a fontes web e gradientes. O template já tem
> fallbacks (Arial/Helvetica e cor sólida roxa no botão) para clientes como Outlook.
