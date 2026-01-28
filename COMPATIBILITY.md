# Compatibility Matrix

This table shows the compatibility between protobuf client versions (rows) and OpenSearch server versions (columns). Use this to determine which protobuf version works with your OpenSearch cluster. When multiple protobuf versions are compatible with the same OpenSearch version, we recommend using the latest protobuf version, as earlier versions may be missing newer fields.

- **OK**: Compatible
- **-**: Not compatible

## OpenSearch 3.x

| Protobuf / OpenSearch | 3.0.0 | 3.1.0 | 3.2.0 | 3.3.x | 3.4.0 |
|----------------------:|:-----:|:-----:|:-----:|:-----:|:-----:|
|                 0.3.0 |  OK   |  OK   |   -   |   -   |   -   |
|                 0.6.0 |   -   |   -   |  OK   |   -   |   -   |
|                0.19.0 |   -   |   -   |   -   |  OK   |   -   |
|                0.24.0 |   -   |   -   |   -   |   -   |  OK   |
