export const GET_METAOBJECTS = `
  query getMetaobjects($type: String!, $first: Int!) {
    metaobjects(type: $type, first: $first) {
      edges {
        node {
          id
          handle
          type
          fields {
            key
            value
            reference {
              ... on MediaImage {
                image {
                  url
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Reseñas de clientes de la landing: los metaobjects `clawpuzzle_resena`, con
 * su archivo (`media`) y sus textos. De `media` se pide tanto `references`
 * (campo de lista) como `reference` (campo de un solo archivo) para que
 * funcione con cualquiera de las dos definiciones.
 */
const REVIEW_MEDIA_FRAGMENT = `
  __typename
  ... on MediaImage {
    id
    alt
    image {
      url
      width
      height
      altText
    }
  }
  ... on Video {
    id
    alt
    previewImage {
      url
      width
      height
    }
    sources {
      url
      mimeType
      width
      height
    }
  }
`;

export const GET_REVIEWS = `
  query getReviews($type: String!, $first: Int!) {
    metaobjects(type: $type, first: $first) {
      nodes {
        id
        body: field(key: "body") {
          value
        }
        author: field(key: "author") {
          value
        }
        city: field(key: "city") {
          value
        }
        # En Shopify la clave quedó como "raiting"; se pide también "rating"
        # por si algún día se corrige en la definición.
        raiting: field(key: "raiting") {
          value
        }
        rating: field(key: "rating") {
          value
        }
        media: field(key: "media") {
          reference {
            ${REVIEW_MEDIA_FRAGMENT}
          }
          references(first: 50) {
            nodes {
              ${REVIEW_MEDIA_FRAGMENT}
            }
          }
        }
      }
    }
  }
`;
